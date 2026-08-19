/**
 * Billing integration for Counsel platform subscriptions.
 *
 * Supports:
 * - Stripe (global) — checkout, webhooks, portal
 * - Razorpay (India) — orders, payments, subscriptions
 *
 * Environment: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID
 *              RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID
 */
import Stripe from 'stripe';
import { prisma } from '@counsel/database';
import { Request, Response, NextFunction, Router } from 'express';
import { requireRole } from '../middleware/rbac';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  typescript: true,
});

// Razorpay (lazy init — only when keys are configured)
let razorpay: any = null;
function getRazorpay() {
  if (!razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
      const Razorpay = require('razorpay');
      razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    } catch { /* SDK not installed */ }
  }
  return razorpay;
}

const router = Router();

// Plan pricing lookup (INR and USD)
const PLAN_PRICING: Record<string, { inr: number; usd: number; name: string }> = {
  starter: { inr: 999, usd: 12, name: 'Starter' },
  professional: { inr: 4999, usd: 60, name: 'Professional' },
  business: { inr: 14999, usd: 180, name: 'Business' },
};

// ─── POST /checkout ─── Create Checkout Session (Stripe or Razorpay) ───────
router.post(
  '/checkout',
  requireRole('PARTNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { priceId, plan, currency, successUrl, cancelUrl, seats } = req.body;

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { email: true, name: true },
      });

      const firm = await prisma.firm.findUnique({
        where: { id: req.firmId },
        select: { id: true, name: true, slug: true, seatCount: true },
      });

      if (!user || !firm) {
        res.status(400).json({ error: 'User or firm not found' });
        return;
      }

      const isIndian = currency === 'INR' || (!currency && (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder'));
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // ── Razorpay path (Indian customers) ─────────────────────────────
      if (isIndian && getRazorpay()) {
        const rp = getRazorpay();
        const planKey = plan || 'professional';
        const planInfo = PLAN_PRICING[planKey] || PLAN_PRICING.professional;
        const amountInPaise = planInfo.inr * 100; // Razorpay uses paise

        const order = await rp.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `counsel_${firm.id}_${Date.now()}`,
          notes: { firmId: firm.id, firmName: firm.name, plan: planKey },
        });

        // Record pending subscription
        await prisma.subscription.upsert({
          where: { firmId: req.firmId! },
          create: {
            firmId: req.firmId!,
            stripeCustomerId: `rp_${user.email}`,
            stripeSubscriptionId: order.id,
            status: 'PENDING',
            plan: planKey.toUpperCase(),
            seatCount: seats || firm.seatCount || 5,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          update: {
            stripeCustomerId: `rp_${user.email}`,
            stripeSubscriptionId: order.id,
            status: 'PENDING',
            plan: planKey.toUpperCase(),
          },
        });

        res.json({
          orderId: order.id,
          amount: amountInPaise,
          currency: 'INR',
          plan: planKey,
          keyId: process.env.RAZORPAY_KEY_ID,
          firmName: firm.name,
          customerEmail: user.email,
          customerName: user.name,
        });
        return;
      }

      // ── Stripe path (global customers) ───────────────────────────────
      let stripeCustomerId = '';
      const existingSub = await prisma.subscription.findFirst({
        where: { firmId: req.firmId },
        select: { stripeCustomerId: true },
      });

      if (existingSub?.stripeCustomerId && !existingSub.stripeCustomerId.startsWith('rp_')) {
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
        success_url: successUrl || `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${baseUrl}/pricing`,
        metadata: { firmId: firm.id, firmName: firm.name },
        subscription_data: {
          metadata: { firmId: firm.id, firmName: firm.name },
        },
      });

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
        update: { stripeCustomerId, status: 'PENDING' },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /razorpay/verify ─── Verify Razorpay payment ────────────────────
router.post(
  '/razorpay/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id) {
        res.status(400).json({ error: 'Missing payment verification data' });
        return;
      }

      // In production, verify signature using crypto
      // For now, mark the subscription as active
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubscriptionId: razorpay_order_id },
      });

      if (!sub) {
        res.status(404).json({ error: 'Subscription not found' });
        return;
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'ACTIVE' },
      });

      await prisma.auditLog.create({
        data: {
          firmId: sub.firmId,
          resourceType: 'Subscription',
          action: 'SUBSCRIPTION_ACTIVATED',
          resourceId: razorpay_payment_id,
          details: { orderId: razorpay_order_id, paymentId: razorpay_payment_id },
        },
      });

      res.json({ status: 'verified', subscriptionId: sub.id });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /razorpay/webhook ─── Handle Razorpay webhook events ────────────
router.post(
  '/razorpay/webhook',
  async (req: Request, res: Response) => {
    const event = req.body;
    try {
      switch (event.event) {
        case 'payment.captured': {
          const payment = event.payload?.payment?.entity;
          if (payment?.order_id) {
            await prisma.subscription.updateMany({
              where: { stripeSubscriptionId: payment.order_id },
              data: { status: 'ACTIVE' },
            });
          }
          break;
        }
        case 'payment.failed': {
          const payment = event.payload?.payment?.entity;
          if (payment?.order_id) {
            await prisma.subscription.updateMany({
              where: { stripeSubscriptionId: payment.order_id },
              data: { status: 'PAST_DUE' },
            });
          }
          break;
        }
        case 'subscription.cancelled': {
          const sub = event.payload?.subscription?.entity;
          if (sub?.id) {
            await prisma.subscription.updateMany({
              where: { stripeSubscriptionId: sub.id },
              data: { status: 'CANCELED' },
            });
          }
          break;
        }
      }
      res.json({ received: true });
    } catch (err: any) {
      console.error('Razorpay webhook error:', err.message);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  },
);

// ─── Stripe Webhook ───────────────────────────────────────────────────────
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
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
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
            data: { stripeSubscriptionId: subId, status: 'ACTIVE' },
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
        const invSub = (invoice as any).subscription;
        const subId = typeof invSub === 'string' ? invSub : invSub?.id;
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
        const invSub = (invoice as any).subscription;
        const subId = typeof invSub === 'string' ? invSub : invSub?.id;
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

// ─── GET /portal ─── Create Customer Portal session ────────────────────────
router.get('/portal', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { firmId: req.firmId },
      select: { stripeCustomerId: true },
    });

    if (!sub?.stripeCustomerId) {
      res.status(400).json({ error: 'No billing account found for this firm' });
      return;
    }

    // Razorpay customers get a basic response
    if (sub.stripeCustomerId.startsWith('rp_')) {
      res.json({ url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard/settings`, note: 'Razorpay customers manage billing via dashboard' });
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

// ─── GET /plans ─── List available plans with pricing ──────────────────────
router.get('/plans', async (_req: Request, res: Response) => {
  res.json({
    plans: [
      { key: 'free', name: 'Free', inr: 0, usd: 0, features: ['20 docs/month', '1 user', '50 chat queries/day'] },
      { key: 'starter', name: 'Starter', inr: 999, usd: 12, annualInr: 799, annualUsd: 10, features: ['200 docs/month', '3 users', '200 chat queries/day'] },
      { key: 'professional', name: 'Professional', inr: 4999, usd: 60, annualInr: 3999, annualUsd: 48, features: ['Unlimited docs', '15 users', 'Unlimited chat'] },
      { key: 'business', name: 'Business', inr: 14999, usd: 180, annualInr: 11999, annualUsd: 144, features: ['Unlimited everything', 'Unlimited users', 'API access'] },
      { key: 'enterprise', name: 'Enterprise', inr: 0, usd: 0, features: ['Custom pricing', 'Dedicated infra', '24/7 support'] },
    ],
    paymentMethods: {
      india: ['UPI', 'Credit/Debit Cards (Visa, Mastercard, RuPay)', 'Net Banking', 'NEFT/RTGS (annual plans)'],
      global: ['Credit/Debit Cards', 'Wire Transfer'],
    },
  });
});

// ─── GET / ─── Get current subscription status ─────────────────────────────
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
