import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// ─── POST /chat-copilot/message ───────────────────────────────────────────
router.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    const firmId = (req as any).firmId;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required', code: 'VALIDATION' });
      return;
    }

    // Try to proxy to AI service, fall back gracefully
    let aiResponse = null;
    try {
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const ai = await fetch(`${aiUrl}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, firmId }),
        signal: AbortSignal.timeout(30000),
      });
      if (ai.ok) {
        aiResponse = await ai.json();
      }
    } catch {
      // AI service unavailable — return helpful fallback
    }

    if (aiResponse) {
      res.json(aiResponse);
      return;
    }

    // Fallback: return a structured response without AI
    res.json({
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `I received your question about "${message.substring(0, 80)}". 

The AI service is currently initializing. Here's what I can help with right now:

• **Documents** — Upload, search, and analyze contracts and legal documents
• **Matters** — View and manage your active legal and consulting matters
• **Research** — Search case law, statutes, and firm knowledge base
• **Drafts** — Create AI-generated legal documents and proposals

For live AI-powered answers, make sure the AI service is running on port 8000.`,
      timestamp: new Date().toISOString(),
      source: 'fallback',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
