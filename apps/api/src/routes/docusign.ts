/**
 * DocuSign eSignature Routes — envelope CRUD + webhook handler.
 *
 * All routes require auth middleware (userId, firmId from req).
 * Every action creates an audit log entry.
 * The webhook handler verifies the DocuSign Connect HMAC signature.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { DocuSignClient, isDocuSignAvailable } from '../lib/docusign';
import { logIntegrationAction } from '../lib/audit-log';
import { r2Upload } from '../lib/r2-client';

const router = Router();

// ── Middleware: check DocuSign availability ────────────────────────────────

function requireDocuSign(req: Request, res: Response, next: NextFunction): void {
  if (!isDocuSignAvailable()) {
    res.status(503).json({
      error: 'DocuSign integration is not configured',
      code: 'DOCUSIGN_UNAVAILABLE',
      message: 'Set DOCUSIGN_INTEGRATION_KEY and DOCUSIGN_SECRET_KEY to enable DocuSign.',
    });
    return;
  }
  next();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAuth(req: Request): { userId: string; firmId: string } {
  const { userId, firmId } = req as any;
  return { userId, firmId };
}

// ── POST /docusign/envelopes — Create a signing envelope ───────────────────

router.post('/envelopes', requireDocuSign, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const { subject, emailBlurb, documents, signers, tabs, carbonCopies, envelopeCustomFields } = req.body;

    // Validation
    if (!subject) {
      res.status(400).json({ error: 'Missing required field: subject', code: 'VALIDATION_ERROR' });
      return;
    }
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: 'Missing required field: documents (non-empty array)', code: 'VALIDATION_ERROR' });
      return;
    }
    if (!signers || !Array.isArray(signers) || signers.length === 0) {
      res.status(400).json({ error: 'Missing required field: signers (non-empty array)', code: 'VALIDATION_ERROR' });
      return;
    }
    for (const s of signers) {
      if (!s.name || !s.email) {
        res.status(400).json({ error: 'Each signer must have name and email', code: 'VALIDATION_ERROR' });
        return;
      }
    }

    const client = new DocuSignClient(userId);
    const result = await client.createEnvelope({
      subject,
      emailBlurb,
      documents,
      signers,
      tabs,
      carbonCopies,
      envelopeCustomFields,
    });

    await logIntegrationAction(userId, firmId, 'DOCUSIGN_ENVELOPE_CREATED', 'DocuSignEnvelope', result.ok ? (result.data as any).envelopeId : 'unknown', {
      provider: 'docusign',
      envelopeId: result.ok ? (result.data as any).envelopeId : undefined,
      status: result.ok ? 'sent' : 'failed',
      recipients: signers.map((s: any) => s.email),
      documentName: documents[0]?.name,
      error: !result.ok ? result.error : undefined,
    });

    if (!result.ok) {
      res.status(502).json({ error: result.error, code: result.code });
      return;
    }

    res.status(201).json({ data: result.data });
  } catch (err) {
    next(err);
  }
});

// ── GET /docusign/envelopes — List envelopes ───────────────────────────────

router.get('/envelopes', requireDocuSign, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const { fromDate, toDate, status, searchText, limit } = req.query;

    const client = new DocuSignClient(userId);
    const result = await client.listEnvelopes({
      fromDate: fromDate as string | undefined,
      toDate: toDate as string | undefined,
      status: status as string | undefined,
      searchText: searchText as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    await logIntegrationAction(userId, firmId, 'DOCUSIGN_ENVELOPES_LISTED', 'DocuSignEnvelope', '*', {
      provider: 'docusign',
      query: JSON.stringify(req.query),
    });

    if (!result.ok) {
      res.status(502).json({ error: result.error, code: result.code });
      return;
    }

    res.json({ data: result.data });
  } catch (err) {
    next(err);
  }
});

// ── GET /docusign/envelopes/:id — Get envelope status ──────────────────────

router.get('/envelopes/:id', requireDocuSign, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const envelopeId = req.params.id;

    const client = new DocuSignClient(userId);
    const result = await client.getEnvelopeStatus(envelopeId);

    await logIntegrationAction(userId, firmId, 'DOCUSIGN_ENVELOPE_STATUS', 'DocuSignEnvelope', envelopeId, {
      provider: 'docusign',
      envelopeId,
      status: result.ok ? result.data.status : undefined,
      error: !result.ok ? result.error : undefined,
    });

    if (!result.ok) {
      const statusCode = result.code === 'DOCUSIGN_NOT_CONNECTED' ? 401 : 502;
      res.status(statusCode).json({ error: result.error, code: result.code });
      return;
    }

    res.json({ data: result.data });
  } catch (err) {
    next(err);
  }
});

// ── GET /docusign/envelopes/:id/document — Download signed document ────────

router.get('/envelopes/:id/document', requireDocuSign, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const envelopeId = req.params.id;

    const client = new DocuSignClient(userId);
    const result = await client.getSignedDocument(envelopeId);

    await logIntegrationAction(userId, firmId, 'DOCUSIGN_DOCUMENT_DOWNLOADED', 'DocuSignEnvelope', envelopeId, {
      provider: 'docusign',
      envelopeId,
      error: !result.ok ? result.error : undefined,
    });

    if (!result.ok) {
      const statusCode = result.code === 'DOCUSIGN_NOT_CONNECTED' ? 401 : 502;
      res.status(statusCode).json({ error: result.error, code: result.code });
      return;
    }

    // Optionally store the signed document in R2
    const storeToR2 = req.query.store === 'true';
    let r2Key: string | null = null;
    if (storeToR2) {
      const pdfBuffer = Buffer.from(result.data.documentBase64, 'base64');
      const uploadResult = await r2Upload({
        firmId,
        filename: `signed-${envelopeId}.pdf`,
        contentType: result.data.contentType,
        body: pdfBuffer,
      });
      r2Key = uploadResult.key;
    }

    res.json({
      data: {
        documentBase64: result.data.documentBase64,
        contentType: result.data.contentType,
        r2Key,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /docusign/envelopes/:id/void — Void an envelope ───────────────────

router.post('/envelopes/:id/void', requireDocuSign, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const envelopeId = req.params.id;
    const { reason } = req.body;

    const client = new DocuSignClient(userId);
    const result = await client.voidEnvelope(envelopeId, reason || undefined);

    await logIntegrationAction(userId, firmId, 'DOCUSIGN_ENVELOPE_VOIDED', 'DocuSignEnvelope', envelopeId, {
      provider: 'docusign',
      envelopeId,
      status: result.ok ? 'voided' : 'failed',
      reason: reason || 'Voided by user',
      error: !result.ok ? result.error : undefined,
    });

    if (!result.ok) {
      res.status(502).json({ error: result.error, code: result.code });
      return;
    }

    res.json({ data: result.data });
  } catch (err) {
    next(err);
  }
});

// ── POST /docusign/webhook — DocuSign Connect webhook handler ──────────────

router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verify HMAC signature if present
    const signature = (req.headers['x-docusign-signature-1'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (signature) {
      const verified = DocuSignClient.verifyWebhookSignature(rawBody, signature);
      if (!verified) {
        console.warn('[DocuSign Webhook] HMAC signature verification failed');
        res.status(401).json({ error: 'Invalid webhook signature', code: 'WEBHOOK_SIGNATURE_INVALID' });
        return;
      }
    }

    // Parse the Connect notification
    const notification = req.body;
    const envelopeId = notification?.data?.envelopeId || notification?.envelopeId;

    if (!envelopeId) {
      res.status(400).json({ error: 'Missing envelopeId in webhook payload', code: 'WEBHOOK_INVALID_PAYLOAD' });
      return;
    }

    console.log(`[DocuSign Webhook] Received event for envelope: ${envelopeId}`);

    // Log the webhook event
    await logIntegrationAction(
      'system',
      notification?.data?.customFields?.textCustomFields?.find((f: any) => f.name === 'firmId')?.value || 'unknown',
      'DOCUSIGN_WEBHOOK_RECEIVED',
      'DocuSignEnvelope',
      envelopeId,
      {
        provider: 'docusign',
        envelopeId,
        status: notification?.data?.status || notification?.status,
        event: notification?.event,
        rawNotification: notification,
      },
    );

    // Acknowledge receipt — DocuSign expects a 200
    res.status(200).json({ status: 'received' });
  } catch (err) {
    next(err);
  }
});

export default router;