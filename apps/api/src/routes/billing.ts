/**
 * Stripe billing integration for Counsel platform subscriptions.
 *
 * Handles: checkout session creation, webhook verification, subscription
 * lifecycle (created → active → past_due → canceled), and seat count sync.
 *
 * Environment: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
 */
import Stripe from 'stripe';
import { prisma } from '@counsel/database';
import { Request, Response, NextFunction, Router } from 'express';
import { requireRole } from '../middleware/rbac';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-06-30.basil',
  typescript: true,
});

const router = Router();

// ─── POST /checkout ─── Create Stripe Checkout Session ──────────────────────
router.post(
  '/checkout',
  requireRole('PARTNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { priceId, successUrl, cancelUrl, seats } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { email: true, name: true },
      });

      const firm = await prisma.firm.findUnique({
        where: { id: req.firmId },
        select: { id: true, name: true, slug: true },
      });

      if (!user || !firm) {
        res.status(400).json({ error: 'User or firm not found' });
        return;
      }

      // Create or retrieve Stripe customer
      let stripeCustomerId = '';

      // Check if firm already has a Stripe customer ID
      const existingSub = await prisma.subscription.findFirst({
        where: { firmId: req.firmId },
        select: { stripeCustomerId: true },
      });

      if (existingSub?.stripeCustomerId) {
        stripeCustomerId = existingSub.stripeCustomerId;
      } else {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { firmId: firm.id, firmName: firm.name },
        });
        stripeCustomerId = customer.id;
      }

      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId || process.env.STRIPE_PRICE_ID || 'price_placeholder',
            quantity: seats || firm.seatCount || 5,
          },
        ],
        mode: 'subscription',
        success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing`,
        metadata: {
          firmId: firm.id,
          firmName: firm.name,
        },
        subscription_data: {
          metadata: {
            firmId: firm.id,
            firmName: firm.name,
          },
        },
      });

      // Record pending subscription
      await prisma.subscription.upsert({
        where: { firmId: req.firmId! },
        create: {
          firmId: req.firmId!,
          stripeCustomerId,
          stripeSubscriptionId: 'pending',
          status: 'PENDING',
          plan: 'PRO',
          seatCount: seats || firm.seatCount || 5,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          stripeCustomerId,
          status: 'PENDING',
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Webhook ─── Handle Stripe webhook events ────────────────────────────────
// POST /api/v1/billing/webhook — called by Stripe, no auth required
const webhookRouter = Router();

webhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    res.status(400).json({ error: 'Missing Stripe signature or webhook secret' });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body — express.raw() needed in production
      sig,
      secret,
    );
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const firmId = session.metadata?.firmId;
        const subId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

        if (firmId && subId) {
          await prisma.subscription.updateMany({
            where: { firmId },
            data: {
              stripeSubscriptionId: subId,
              status: 'ACTIVE',
            },
          });
          await prisma.auditLog.create({
            data: {
              firmId,
              resourceType: 'Subscription',
              action: 'SUBSCRIPTION_ACTIVATED',
              resourceId: subId,
              details: { sessionId: session.id },
            },
          });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

        if (subId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subId },
            data: {
              status: 'ACTIVE',
              currentPeriodStart: new Date(invoice.period_start * 1000),
              currentPeriodEnd: new Date(invoice.period_end * 1000),
            },
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription?.id;

        if (subId) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: subId },
            data: { status: 'PAST_DUE' },
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: { status: 'CANCELED' },
        });

        // Log cancellation audit
        const firmSub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
          select: { firmId: true },
        });
        if (firmSub) {
          await prisma.auditLog.create({
            data: {
              firmId: firmSub.firmId,
              resourceType: 'Subscription',
              action: 'SUBSCRIPTION_CANCELED',
              resourceId: sub.id,
            },
          });
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook processing error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ─── GET /portal ─── Create Stripe Customer Portal session ──────────────────
router.get('/portal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { firmId: req.firmId },
      select: { stripeCustomerId: true },
    });

    if (!sub?.stripeCustomerId) {
      res.status(400).json({ error: 'No Stripe customer found for this firm' });
      return;
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings`,
    });

    res.json({ url: portal.url });
  } catch (err) {
    next(err);
  }
});

// ─── GET / ─── Get current subscription status ──────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { firmId: req.firmId },
      select: {
        id: true,
        status: true,
        plan: true,
        seatCount: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        stripeSubscriptionId: true,
      },
    });

    if (!sub) {
      res.json({ status: 'NONE', plan: 'FREE', seatCount: 0 });
      return;
    }

    res.json(sub);
  } catch (err) {
    next(err);
  }
});

export { webhookRouter };
export default router;
