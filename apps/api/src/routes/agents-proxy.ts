import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// ─── Proxy AI agent calls from frontend → Python AI service ──────────────

async function proxyToAI(req: Request, res: Response, next: NextFunction, endpoint: string) {
  try {
    const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    const ai = await fetch(`${aiUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: AbortSignal.timeout(60000),
    });

    if (ai.ok) {
      const data = await ai.json();
      res.json(data);
      return;
    }

    // AI returned an error
    const errBody = await ai.text().catch(() => '');
    res.status(ai.status).json({
      error: 'AI service error',
      code: 'AI_ERROR',
      details: errBody.substring(0, 500),
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      res.status(504).json({
        error: 'AI service timed out. The request may still be processing.',
        code: 'AI_TIMEOUT',
      });
      return;
    }
    res.status(503).json({
      error: 'AI service is currently unavailable. Please try again.',
      code: 'AI_UNREACHABLE',
    });
  }
}

// ─── POST /agents/proposal ───────────────────────────────────────────────
router.post('/proposal', (req: Request, res: Response, next: NextFunction) => {
  proxyToAI(req, res, next, '/agents/proposal');
});

// ─── POST /agents/market-intel ───────────────────────────────────────────
router.post('/market-intel', (req: Request, res: Response, next: NextFunction) => {
  proxyToAI(req, res, next, '/agents/market-intel');
});

// ─── POST /agents/analyze/contract ───────────────────────────────────────
router.post('/analyze/contract', (req: Request, res: Response, next: NextFunction) => {
  proxyToAI(req, res, next, '/agents/analyze/contract');
});

// ─── POST /agents/draft ──────────────────────────────────────────────────
router.post('/draft', (req: Request, res: Response, next: NextFunction) => {
  proxyToAI(req, res, next, '/agents/draft');
});

// ─── POST /agents/research ───────────────────────────────────────────────
router.post('/research', (req: Request, res: Response, next: NextFunction) => {
  proxyToAI(req, res, next, '/agents/research');
});

export default router;
