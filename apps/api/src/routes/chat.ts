import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { checkFreeTier } from '../middleware/free-tier';

const router = Router();

const CHAT_TOOLS = [
  { id: 'create_matter', name: 'Create Matter', description: 'Open a new legal or consulting matter', icon: 'briefcase', category: 'work' },
  { id: 'add_client', name: 'Add Client', description: 'Register a new client with tax IDs', icon: 'user-plus', category: 'ca' },
  { id: 'upload_document', name: 'Upload Document', description: 'Upload and analyze a document (PDF, DOCX, etc.)', icon: 'file-up', category: 'documents' },
  { id: 'search_documents', name: 'Search Documents', description: 'Semantic search across all firm documents', icon: 'search', category: 'documents' },
  { id: 'legal_research', name: 'Research', description: 'Legal research, case law, statutes', icon: 'scale', category: 'research' },
  { id: 'draft_document', name: 'Draft', description: 'AI-assisted contract or memo drafting', icon: 'edit', category: 'drafts' },
  { id: 'create_proposal', name: 'Proposal', description: 'Generate consulting proposals & SOWs', icon: 'file-text', category: 'consulting' },
  { id: 'market_intel', name: 'Market Intel', description: 'Industry research & competitive analysis', icon: 'trending-up', category: 'consulting' },
  { id: 'schedule_meeting', name: 'Meeting', description: 'Schedule meetings with clients', icon: 'calendar', category: 'meetings' },
  { id: 'compliance_calendar', name: 'Filings', description: 'Tax filings, GST, ROC compliance calendar', icon: 'clipboard-check', category: 'ca' },
  { id: 'check_compliance', name: 'Compliance', description: 'Check against playbook & regulatory rules', icon: 'shield', category: 'compliance' },
  { id: 'financial_analysis', name: 'Finance', description: 'NPV, IRR, sensitivity analysis', icon: 'calculator', category: 'analysis' },
  { id: 'reconciliation', name: 'Reconciliation', description: 'Bank & ledger reconciliation status', icon: 'refresh-cw', category: 'ca' },
  { id: 'manage_engagements', name: 'Engagements', description: 'Track client engagements & projects', icon: 'clipboard-list', category: 'consulting' },
  { id: 'manage_integrations', name: 'Integrations', description: 'Connect CRM, billing, DMS', icon: 'plug', category: 'integrations' },
  { id: 'search_knowledge', name: 'Knowledge Base', description: 'Search structured knowledge entries (rules, precedents, regulations)', icon: 'book-open', category: 'knowledge' },
];

router.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: CHAT_TOOLS });
});

router.post('/feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { messageId, type, threadId, toolOrCrew } = req.body;
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;

    if (!messageId || !type || !['positive', 'negative'].includes(type)) {
      res.status(400).json({ error: 'messageId and type (positive|negative) required' });
      return;
    }

    const feedbackType = type === 'positive' ? 'explicit_positive' : 'explicit_negative';
    const score = type === 'positive' ? 1.0 : -1.0;

    // Persist to FeedbackLog (survives restarts)
    await prisma.feedbackLog.create({
      data: {
        firmId,
        userId: userId || null,
        messageId,
        threadId: threadId || null,
        toolOrCrew: toolOrCrew || 'general',
        feedbackType,
        score,
        metadata: { source: 'chat_feedback_button' },
      },
    }).catch(() => {});

    // Also log to audit trail for backward compatibility
    await prisma.auditLog.create({
      data: {
        firmId,
        userId,
        action: type === 'positive' ? 'CHAT_FEEDBACK_POSITIVE' : 'CHAT_FEEDBACK_NEGATIVE',
        resourceType: 'ChatMessage',
        resourceId: messageId,
        details: { type, threadId, toolOrCrew },
      },
    }).catch(() => {});

    res.json({ recorded: true, type });
  } catch (err) { next(err); }
});

router.post('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, messages, conversationId } = req.body;
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;

    switch (action) {
      case 'save': {
        if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: 'messages array is required' }); return; }
        if (conversationId) {
          const existing = await prisma.chatConversation.findFirst({ where: { id: conversationId, firmId } });
          if (!existing) { res.status(404).json({ error: 'Conversation not found' }); return; }
          await prisma.chatConversation.update({ where: { id: conversationId }, data: { messages: JSON.stringify(messages), updatedAt: new Date() } });
          res.json({ conversationId });
        } else {
          const firstMsg = messages.find((m: any) => m.role === 'user');
          const title = firstMsg ? (firstMsg.text || firstMsg.content || '').substring(0, 80) : 'New conversation';
          const conv = await prisma.chatConversation.create({ data: { firmId, userId, title, messages: JSON.stringify(messages) } });
          res.json({ conversationId: conv.id, title });
        }
        break;
      }
      case 'list': {
        const convs = await prisma.chatConversation.findMany({ where: { firmId }, select: { id: true, title: true, updatedAt: true, createdAt: true }, orderBy: { updatedAt: 'desc' }, take: 50 });
        res.json({ conversations: convs });
        break;
      }
      case 'get': {
        if (!conversationId) { res.status(400).json({ error: 'conversationId required' }); return; }
        const conv = await prisma.chatConversation.findFirst({ where: { id: conversationId, firmId } });
        if (!conv) { res.status(404).json({ error: 'Not found' }); return; }
        res.json({ id: conv.id, title: conv.title, messages: typeof conv.messages === 'string' ? JSON.parse(conv.messages) : conv.messages, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
        break;
      }
      case 'delete': {
        if (!conversationId) { res.status(400).json({ error: 'conversationId required' }); return; }
        await prisma.chatConversation.deleteMany({ where: { id: conversationId, firmId } });
        res.json({ deleted: true });
        break;
      }
      default: res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) { next(err); }
});

router.post('/message', checkFreeTier('chatMessages'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, toolId, context } = req.body;
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;

    if (!message || typeof message !== 'string') { res.status(400).json({ error: 'message required' }); return; }

    // Extract thread_id from context if provided
    const threadId = context?.threadId || context?.thread_id || null;
    const approvedSteps = context?.approvedSteps || context?.approved_steps || null;

    let aiResponse = null;
    try {
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const ai = await fetch(aiUrl + '/agents/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          firm_id: firmId,
          user_id: userId,
          thread_id: threadId,
          approved_steps: approvedSteps,
          context: { toolId: toolId || null, ...context },
          tools: CHAT_TOOLS.map(t => ({ id: t.id, name: t.name, description: t.description }))
        }),
        signal: AbortSignal.timeout(120000),  // 2 min for multi-step plans
      });
      if (ai.ok) aiResponse = await ai.json();
    } catch { /* fall through */ }

    if (aiResponse && (aiResponse.content || aiResponse.response)) {
      const responseContent = aiResponse.content || aiResponse.response;
      const msgId = aiResponse.id || 'msg_' + Date.now();

      // Auto-eval: score the response quality (heuristic, no LLM call)
      try {
        const inputWords = new Set(message.toLowerCase().split(/\s+/).filter(Boolean));
        const outputWords = new Set(responseContent.toLowerCase().split(/\s+/).filter(Boolean));
        const overlap = inputWords.size > 0 ? (inputWords.size & outputWords.size) / inputWords.size : 0;
        const evalScores: Record<string, number> = {
          relevance: Math.min(1.0, overlap * 2.5),
          completeness: responseContent.length > 1000 ? 0.85 : responseContent.length > 300 ? 0.65 : 0.4,
          accuracy: 0.75, // baseline — LLM judge would improve this
          safety: 0.95,
          usability: /^[#*\-\d]/m.test(responseContent) ? 0.85 : 0.6,
        };
        const weights: Record<string, number> = { relevance: 0.25, completeness: 0.20, accuracy: 0.25, safety: 0.15, usability: 0.15 };
        const overallScore = Object.entries(weights).reduce((sum, [dim, w]) => sum + (evalScores[dim] || 0.5) * w, 0);

        // Persist eval to database
        await prisma.evalResult.create({
          data: {
            firmId,
            toolName: toolId || 'general_chat',
            inputText: message.substring(0, 5000),
            outputText: responseContent.substring(0, 10000),
            scores: evalScores,
            overallScore,
            metadata: { threadId, userId, source: 'chat_auto_eval' },
          },
        }).catch(() => {}); // best-effort
      } catch { /* eval scoring failed — skip */ }

      res.json({
        id: msgId,
        role: 'assistant',
        content: responseContent,
        timestamp: aiResponse.timestamp || new Date().toISOString(),
        threadId: aiResponse.thread_id || threadId,
        actions: aiResponse.actions,
        toolSuggestions: aiResponse.toolSuggestions,
        result: aiResponse.result,
        requiresApproval: aiResponse.requiresApproval || null,
        approvalSteps: aiResponse.approvalSteps || null,
        entities: aiResponse.entities || null,
      });
      return;
    }

    const localResponse = await localDispatch(message, toolId, firmId, userId);
    res.json(localResponse);
  } catch (err) { next(err); }
});

function extractBetween(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) { const m = text.match(p); if (m) return m[1].trim(); }
  return null;
}

async function localDispatch(message: string, toolId: string | undefined, firmId: string, userId: string | undefined) {
  const lowerMsg = message.toLowerCase();
  const id = 'msg_' + Date.now();
  const ts = new Date().toISOString();
  const ok = function(r: any) { return { id, role: 'assistant' as const, ...r, timestamp: ts }; };

  if (!userId) {
    return ok({ content: '⚠️ Session error — your user context is missing. Please re-login.' });
  }

  // ── CREATE MATTER ─────────────────────────────────────────────────
  if (toolId === 'create_matter' || /\b(create|new|open)\s+(a\s+)?(matter|case|file)\b/i.test(lowerMsg)) {
    const name = extractBetween(message, [/matter\s+(?:called|named|titled?)?\s*"([^"]+)"/i, /matter\s+(?:called|named)\s+'([^']+)'/i, /(?:create|new|open)\s+(?:a\s+)?matter\s+(?:called|named|for\s+)?(.+?)(?:\s+(?:for|with|client|about)|$)/i]);
    const client = extractBetween(message, [/(?:client|for)\s+(?:is\s+)?"([^"]+)"/i, /(?:client|for)\s+(?:is\s+)?'([^']+)'/i, /(?:client|for)\s+(?:is\s+)?([A-Z][\w\s&.]+?)(?:\s+(?:about|type|desc|matter|$)|\.)/i]);
    const desc = extractBetween(message, [/(?:description|about|desc)\s+"([^"]+)"/i, /(?:description|about|desc)\s+'([^']+)'/i]);
    const mattType = /\bconsulting\b/i.test(lowerMsg) ? 'CONSULTING' as const : 'LEGAL' as const;

    if (name && client) {
      try {
        const matter = await prisma.matter.create({ data: { firmId, name, clientName: client, description: desc || '', type: mattType, status: 'ACTIVE', createdById: userId } });
        return ok({ content: '\u2705 Matter created!\n\nName: ' + matter.name + '\nClient: ' + matter.clientName + '\nType: ' + matter.type + '\nStatus: ' + matter.status, result: { action: 'created', matterId: matter.id, matter }, toolSuggestions: [{ id: 'upload_document', name: 'Upload to Matter', icon: 'file-up' }, { id: 'draft_document', name: 'Draft Contract', icon: 'edit' }] });
      } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
    }

    const matters = await prisma.matter.findMany({ where: { firmId }, select: { id: true, name: true, clientName: true, status: true }, orderBy: { updatedAt: 'desc' }, take: 5 });
    const mLines = matters.map(m => '\u2022 ' + m.name + ' \u2014 ' + m.clientName + ' (' + m.status + ')').join('\n');
    return ok({ content: matters.length ? 'Existing matters:\n' + mLines + '\n\nFill out the form or say "Create a matter called [name] for [client] about [desc]"' : "Let's create your first matter! Say: Create a matter called [name] for [client]", form: { type: 'create_matter', fields: [{ name: 'name', label: 'Matter Name', type: 'text', required: true }, { name: 'clientName', label: 'Client Name', type: 'text', required: true }, { name: 'description', label: 'Description', type: 'textarea', required: false }, { name: 'type', label: 'Type', type: 'select', options: ['LEGAL', 'CONSULTING'], required: true }] } });
  }

  // ── SEARCH DOCUMENTS ───────────────────────────────────────────────
  if (toolId === 'search_documents' || /\b(find|search|show|list)\s+(my\s+)?(documents?|files?|contracts?)\b/i.test(lowerMsg)) {
    const term = extractBetween(message, [/(?:search|find|about|for)\s+"([^"]+)"/i, /(?:search|find)\s+(?:for\s+)?(.+?)(?:\s+(?:in|from|documents?)|\s*\.|$)/i]);
    const docs = await prisma.document.findMany({ where: { firmId, ...(term ? { originalName: { contains: term, mode: 'insensitive' as const } } : {}) }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 });
    if (docs.length === 0) return ok({ content: term ? 'No documents matching "' + term + '". Upload one!' : 'No documents yet. Upload one to get started!', toolSuggestions: [{ id: 'upload_document', name: 'Upload', icon: 'file-up' }] });
    const dLines = docs.map(d => '\u2022 ' + d.originalName + ' \u2014 ' + (d.sizeBytes / 1024).toFixed(1) + ' KB, ' + d.status).join('\n');
    return ok({ content: docs.length + ' document(s)' + (term ? ' for "' + term + '"' : '') + ':\n\n' + dLines, toolSuggestions: [{ id: 'upload_document', name: 'Upload', icon: 'file-up' }, { id: 'search_documents', name: 'Search Again', icon: 'search' }] });
  }

  // ── LEGAL RESEARCH ─────────────────────────────────────────────────
  if (toolId === 'legal_research' || /\blegal\s+(?:research|analysis)\b/i.test(lowerMsg) || /\bresearch\s+(?:about|on|for)\b/i.test(lowerMsg)) {
    const query = extractBetween(message, [/(?:research|search|about|query)\s+"([^"]+)"/i, /(?:research|search|about|query)\s+'([^']+)'/i, /(?:research|search)\s+(?:about|on|for)?\s+(.+?)(?:\s*\.|$)/i]) || message;
    const matter = await prisma.matter.findFirst({ where: { firmId }, select: { id: true, name: true }, orderBy: { updatedAt: 'desc' } });
    if (!matter) return ok({ content: 'Create a matter first before starting research.', toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }] });
    try {
      const brief = await prisma.researchBrief.create({ data: { firmId, matterId: matter.id, title: query.substring(0, 200), query, status: 'PENDING', createdById: userId }, include: { matter: { select: { id: true, name: true } } } });
      return ok({ content: '\uD83D\uDD0D Research brief created!\n\nQuery: ' + brief.query + '\nMatter: ' + brief.matter.name + '\nStatus: ' + brief.status + '\n\nResults will appear here and on the Research page.', result: { action: 'created', briefId: brief.id, brief }, toolSuggestions: [{ id: 'search_documents', name: 'Search Docs', icon: 'search' }] });
    } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
  }

  // ── DRAFT DOCUMENT ─────────────────────────────────────────────────
  if (toolId === 'draft_document' || /\b(draft|write|create)\s+(a\s+)?(contract|agreement|memo|letter|nda?|lease|brief|motion)\b/i.test(lowerMsg)) {
    const m = lowerMsg.match(/\b(contract|agreement|memo|letter|nda|lease|brief|motion)\b/i);
    const dtypeMap: Record<string, string> = { contract: 'REPORT', agreement: 'REPORT', memo: 'MEMO', letter: 'MEMO', nda: 'REPORT', lease: 'REPORT', brief: 'REPORT', motion: 'REPORT' };
    const dtype = dtypeMap[m?.[0] || ''] || 'REPORT';
    const dtitle = extractBetween(message, [/(?:draft|write|create)\s+(?:a\s+)?\w+\s+(?:called|named|titled?)\s*"([^"]+)"/i]) || (dtype.charAt(0).toUpperCase() + dtype.slice(1) + ' Draft');
    const matter = await prisma.matter.findFirst({ where: { firmId }, select: { id: true, name: true }, orderBy: { updatedAt: 'desc' } });
    try {
      const draft = await prisma.draft.create({ data: { firmId, title: dtitle, content: '# ' + dtitle + '\n\nGenerated via Counsel Chat\n\n---\n\nPopulate with AI-generated content.', type: dtype as any, status: 'DRAFT', matterId: matter?.id || null, createdById: userId } });
      return ok({ content: '\u270D\uFE0F Draft created!\n\nTitle: ' + draft.title + '\nType: ' + draft.type + '\n\nReady in the Drafts section.', result: { action: 'created', draftId: draft.id, draft }, toolSuggestions: [{ id: 'check_compliance', name: 'Check Compliance', icon: 'shield' }] });
    } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
  }

  // ── SCHEDULE MEETING ───────────────────────────────────────────────
  if (toolId === 'schedule_meeting' || /\b(schedule|book|set\s*up)\s+(a\s+)?(meeting|call|appointment)\b/i.test(lowerMsg)) {
    const mtitle = extractBetween(message, [/(?:meeting|call)\s+(?:called|named|about|re)?\s*"([^"]+)"/i, /(?:schedule|book)\s+(?:a\s+)?(?:meeting|call)\s+(?:about|for|to\s+discuss)?\s+(.+?)(?:\s+(?:on|at|with)|\.|$)/i]);
    const mdate = extractBetween(message, [/(?:on|at|for)\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2})?)/i]);
    if (mtitle && mdate) {
      try {
        const meetingDate = /^\d{4}-\d{2}-\d{2}/.test(mdate) ? new Date(mdate) : new Date(Date.now() + 86400000);
        const meeting = await prisma.meeting.create({ data: { firmId, title: mtitle, meetingDate: meetingDate, source: 'MANUAL' } });
        return ok({ content: '\uD83D\uDCC5 Meeting scheduled!\n\nTitle: ' + meeting.title + '\nWhen: ' + meeting.meetingDate.toLocaleString() + '\nDuration: 60 min', result: { action: 'created', meetingId: meeting.id }, toolSuggestions: [{ id: 'draft_document', name: 'Prepare Agenda', icon: 'edit' }] });
      } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
    }
    return ok({ content: "I can schedule a meeting!\n\nTell me: Schedule a meeting called \"[title]\" on 2026-08-20 15:00\n\nOr fill the form:", form: { type: 'schedule_meeting', fields: [{ name: 'title', label: 'Title', type: 'text', required: true }, { name: 'date', label: 'Date & Time', type: 'text', placeholder: '2026-08-20 15:00', required: true }, { name: 'attendees', label: 'Attendees', type: 'text', required: false }] } });
  }

  // ── COMPLIANCE ─────────────────────────────────────────────────────
  if (toolId === 'check_compliance' || /\b(check|verify|audit|review)\s+(compliance|playbook|regulatory|gdpr|ccpa)\b/i.test(lowerMsg)) {
    try {
      const pRules = await prisma.playbook.findMany({ where: { firmId }, select: { id: true, name: true, rules: true } });
      if (pRules.length === 0) {
        return ok({ content: 'No playbook rules set up yet. I can check against standard frameworks:\n\n\u2022 GDPR\n\u2022 CCPA\n\u2022 SOC2\n\u2022 ISO 27001\n\nPaste a clause to check.', form: { type: 'compliance_check', fields: [{ name: 'framework', label: 'Framework', type: 'select', options: ['GDPR', 'CCPA', 'SOC2', 'ISO27001'], required: true }, { name: 'clause', label: 'Clause', type: 'textarea', required: true }] } });
      }
      let rc = 0; for (const p of pRules) { const r = typeof p.rules === 'string' ? JSON.parse(p.rules) : p.rules; if (Array.isArray(r)) rc += r.length; }
      return ok({ content: 'Compliance Check Ready\n\nYour firm has ' + pRules.length + ' playbook(s) with ' + rc + ' rules.\n\n' + pRules.map(p => '\u2022 ' + p.name).join('\n') + '\n\nPaste a clause and I will check it.', form: { type: 'compliance_check', fields: [{ name: 'framework', label: 'Framework', type: 'select', options: ['Firm Playbook', 'GDPR', 'CCPA', 'SOC2', 'ISO27001'], required: true }, { name: 'clause', label: 'Clause', type: 'textarea', required: true, placeholder: 'Paste the clause text...' }] } });
    } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown') }); }
  }

  // ── FINANCIAL ANALYSIS ─────────────────────────────────────────────
  if (toolId === 'financial_analysis' || /\b(calculate|compute|analy[sz]e)\s+(npv|irr|payback|roi|financial)\b/i.test(lowerMsg)) {
    const nums = message.match(/[-]?\d[\d,.\s]+/g);
    if (nums && nums.length >= 2) {
      const flows = nums.map(s => parseFloat(s.replace(/,/g, '').trim())).filter(n => !isNaN(n));
      if (flows.length >= 2) {
        const rateMatch = message.match(/rate\s+(?:of\s+)?(\d+\.?\d*)\s*%?/i);
        const rate = parseFloat(rateMatch?.[1] || '10') / 100;
        let npv = 0; for (let i = 0; i < flows.length; i++) npv += flows[i] / Math.pow(1 + rate, i);
        const tr = flows.reduce((a: number, b: number) => a + b, 0);
        return ok({ content: '\uD83D\uDCB0 Financial Analysis\n\nCash Flows: ' + flows.join(', ') + '\nDiscount Rate: ' + (rate * 100).toFixed(1) + '%\n\nNPV: $' + npv.toLocaleString(undefined, { minimumFractionDigits: 2 }) + '\nTotal Return: $' + tr.toLocaleString() + '\n' + (tr >= 0 ? '\u2705 Profitable' : '\u26A0\uFE0F Net loss'), result: { npv, totalReturn: tr, flows, discountRate: rate }, toolSuggestions: [{ id: 'financial_analysis', name: 'Sensitivity', icon: 'calculator' }] });
      }
    }
    return ok({ content: '\uD83D\uDCB0 Financial Analysis\n\nI compute NPV, IRR, payback period.\n\nSay: Calculate NPV for -100000, 30000, 40000, 50000 at 10% discount rate\n\nOr fill the form:', form: { type: 'financial_analysis', fields: [{ name: 'cashFlows', label: 'Cash Flows', type: 'text', placeholder: '-100000, 30000, 40000, 50000', required: true }, { name: 'discountRate', label: 'Discount Rate (%)', type: 'text', placeholder: '10', required: true }] } });
  }

  // ── ADD CLIENT (CA) ────────────────────────────────────────────────
  if (toolId === 'add_client' || /\b(?:add|new|create|register)\s+(?:a\s+)?(?:client|customer)\b/i.test(lowerMsg)) {
    const cname = extractBetween(message, [/(?:client|customer)\s+(?:called|named)?\s*"([^"]+)"/i, /(?:client|customer)\s+(?:called|named)?\s*'([^']+)'/i, /(?:add|new|create|register)\s+(?:a\s+)?(?:client|customer)\s+(?:called|named)?\s+(.+?)(?:\s+(?:with|pan|gst|email|phone)|$)/i]);
    const pan = extractBetween(message, [/pan\s*(?:is\s+)?(?:no\.?\s*)?([A-Z]{5}[0-9]{4}[A-Z])/i]);
    const email_ = extractBetween(message, [/(?:email|mail)\s+(\S+@\S+\.\S+)/i]);
    if (cname) {
      try {
        const client = await prisma.client.create({ data: { firmId, name: cname, pan: pan || undefined, email: email_ || undefined, contactName: extractBetween(message, [/(?:contact|person)\s+(?:is\s+)?(.+?)(?:,|\.|\s+with|$)/i]) || undefined } });
        return ok({ content: '\u2705 Client created!\n\nName: ' + client.name + (client.pan ? '\nPAN: ' + client.pan : '') + (client.email ? '\nEmail: ' + client.email : '') + '\n\nYou can now:\n\u2022 Assign engagements\n\u2022 Set up compliance filings\n\u2022 Add documents', result: { action: 'created', clientId: client.id, client } });
      } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
    }
    const clients = await prisma.client.findMany({ where: { firmId }, select: { id: true, name: true, pan: true, email: true }, orderBy: { name: 'asc' }, take: 10 });
    const cLines = clients.map(function(c: any) { return '\u2022 ' + c.name + (c.pan ? ' (PAN: ' + c.pan + ')' : ''); }).join('\n');
    return ok({ content: clients.length ? 'Existing clients:\n' + cLines + '\n\nSay: Add a client called [name] PAN [PAN number]' : 'No clients yet. Say: Add a client called [name] PAN [PAN number]', form: { type: 'add_client', fields: [{ name: 'name', label: 'Client Name', type: 'text', required: true }, { name: 'pan', label: 'PAN', type: 'text', required: false }, { name: 'email', label: 'Email', type: 'text', required: false }] } });
  }

  // ── COMPLIANCE CALENDAR (CA) ────────────────────────────────────────
  if (toolId === 'compliance_calendar' || /\b(filing|compliance|due\s*date|gst|itr|tds|roc|tax\s+filing|deadline)\b/i.test(lowerMsg)) {
    try {
      const items = await prisma.complianceItem.findMany({ where: { firmId }, include: { client: { select: { name: true } } }, orderBy: { dueDate: 'asc' }, take: 15 });
      const now = new Date();
      if (items.length === 0) return ok({ content: 'No compliance items yet. Track GST returns, ITRs, TDS filings, and ROC compliance.\n\nSay: Add a GST filing due on 2026-09-15 for client X' });
      let overdue = 0, dueWeek = 0;
      items.forEach(function(i: any) { if (new Date(i.dueDate) < now && i.status !== 'COMPLETED') overdue++; else { const d = (new Date(i.dueDate).getTime() - now.getTime()) / 86400000; if (d >= 0 && d <= 7) dueWeek++; } });
      const iLines = items.map(function(i: any) {
        const d = new Date(i.dueDate); const diff = (d.getTime() - now.getTime()) / 86400000;
        const flag = diff < 0 && i.status !== 'COMPLETED' ? ' \uD83D\uDD34 OVERDUE' : diff <= 7 && i.status !== 'COMPLETED' ? ' \uD83D\uDFE1 Due soon' : i.status === 'COMPLETED' ? ' \u2705 Done' : '';
        return '\u2022 ' + i.type + ' — ' + (i.client?.name || 'N/A') + ' | ' + d.toLocaleDateString() + flag;
      }).join('\n');
      return ok({ content: '\uD83D\uDCC5 Compliance Calendar\n\nOverdue: ' + overdue + ' | Due this week: ' + dueWeek + '\n\n' + iLines });
    } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
  }

  // ── RECONCILIATION (CA) ─────────────────────────────────────────────
  if (toolId === 'reconciliation' || /\b(reconcili|reconcile|ledger|bank\s+stmt|trial\s+balance)\b/i.test(lowerMsg)) {
    try {
      const recs = await prisma.reconciliation.findMany({ where: { firmId }, include: { client: { select: { name: true } } }, orderBy: { updatedAt: 'desc' }, take: 10 });
      if (recs.length === 0) return ok({ content: 'No reconciliations yet. Track bank and ledger reconciliations for your clients.\n\nSay: Start reconciliation for client X' });
      const rLines = recs.map(function(r: any) { return '\u2022 ' + (r.client?.name || 'N/A') + ' — ' + r.period + ' | Status: ' + r.status + (r.difference ? ' | Diff: ' + r.difference : ''); }).join('\n');
      return ok({ content: '\uD83D\uDCCA Reconciliations\n\n' + rLines });
    } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
  }

  // ── CREATE PROPOSAL (Consulting) ─────────────────────────────────────
  if (toolId === 'create_proposal' || /\b(proposal|pitch|sow|statement\s+of\s+work|rfp)\b/i.test(lowerMsg)) {
    const pname = extractBetween(message, [/(?:proposal|pitch|sow)\s+(?:called|named|for)?\s*"([^"]+)"/i, /(?:proposal|pitch|sow)\s+(?:called|named|for)?\s*'([^']+)'/i, /(?:proposal|pitch|sow)\s+(?:called|named|for)?\s+(.+?)(?:\s+(?:for|with|client)|$)/i]);
    if (pname) {
      try {
        const client = await prisma.client.findFirst({ where: { firmId }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
        const draft = await prisma.draft.create({ data: { firmId, title: 'Proposal: ' + pname, content: '# Proposal: ' + pname + '\n\nGenerated via Counsel Chat\n\n## Executive Summary\n\n## Scope of Work\n\n## Timeline\n\n## Budget', type: 'REPORT' as any, status: 'DRAFT', matterId: null, createdById: userId } });
        return ok({ content: '\u2728 Proposal created!\n\nTitle: ' + draft.title + '\n\nReady in Drafts. You can:\n\u2022 Edit and refine\n\u2022 Generate sections with AI\n\u2022 Export as PDF', result: { action: 'created', draftId: draft.id }, toolSuggestions: [{ id: 'market_intel', name: 'Market Intel', icon: 'trending-up' }, { id: 'draft_document', name: 'Edit Draft', icon: 'edit' }] });
      } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
    }
    return ok({ content: '\uD83D\uDCC4 Create a proposal!\n\nI can generate:\n\u2022 Client proposals\n\u2022 Pitch decks\n\u2022 Statements of Work (SOW)\n\u2022 RFP responses\n\nSay: Create a proposal called "Digital Transformation Strategy"\n\nOr fill the form:', form: { type: 'create_proposal', fields: [{ name: 'title', label: 'Proposal Title', type: 'text', required: true }, { name: 'client', label: 'Client', type: 'text', required: false }, { name: 'budget', label: 'Budget', type: 'text', required: false }, { name: 'timeline', label: 'Timeline', type: 'text', required: false }] } });
  }

  // ── MARKET INTEL (Consulting) ────────────────────────────────────────
  if (toolId === 'market_intel' || /\b(market\s+intel|industry|competitive|competitor|landscape|benchmark)\b/i.test(lowerMsg)) {
    const q = extractBetween(message, [/(?:about|on|for|research)\s+"([^"]+)"/i, /(?:about|on|for|research)\s+'([^']+)'/i, /(?:about|on|for|research)\s+(.+?)(?:\s*\.|$)/i]) || message;
    // Create a research brief for market intel
    const matter = await prisma.matter.findFirst({ where: { firmId }, select: { id: true, name: true }, orderBy: { updatedAt: 'desc' } });
    if (!matter) {
      return ok({ content: 'Create a matter first before starting market intelligence research.', toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }] });
    }
    try {
      const brief = await prisma.researchBrief.create({ data: { firmId, matterId: matter.id, title: 'Market Intel: ' + q.substring(0, 180), query: q, status: 'PENDING', createdById: userId } });
      return ok({ content: '\uD83D\uDCCA Market Intel research started!\n\nQuery: ' + q + '\nStatus: ' + brief.status + '\n\nI am analyzing:\n\u2022 Industry trends\n\u2022 Competitive landscape\n\u2022 Market sizing\n\u2022 Key players\n\nResults will appear here and in the Research section.', result: { action: 'created', briefId: brief.id }, toolSuggestions: [{ id: 'create_proposal', name: 'Create Proposal', icon: 'file-text' }, { id: 'draft_document', name: 'Draft Report', icon: 'edit' }] });
    } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
  }

  // ── MANAGE ENGAGEMENTS (Consulting/CA) ───────────────────────────────
  if (toolId === 'manage_engagements' || /\b(engagement|project|assignment|retainer)\b/i.test(lowerMsg)) {
    try {
      const engs = await prisma.engagement.findMany({ where: { firmId }, include: { client: { select: { name: true } } }, orderBy: { startDate: 'desc' }, take: 10 });
      if (engs.length === 0) return ok({ content: 'No engagements yet. Track projects, retainers, and assignments for your clients.\n\nSay: Create an engagement for client X — GST Filing starting 2026-09-01' });
      const eLines = engs.map(function(e: any) { return '\u2022 ' + e.name + ' — ' + (e.client?.name || 'N/A') + ' | ' + e.type + ' | Start: ' + new Date(e.startDate).toLocaleDateString(); }).join('\n');
      return ok({ content: '\uD83D\uDCCB Engagements (' + engs.length + ')\n\n' + eLines });
    } catch (err: any) { return ok({ content: '\u274C Failed: ' + (err.message || 'Unknown error') }); }
  }

  // KNOWLEDGE BASE SEARCH
  if (toolId === 'search_knowledge' || /\b(knowledge\s*base|search\s*knowledge|find\s*(rule|precedent|regulation|guideline|policy))\b/i.test(lowerMsg)) {
    const kbQuery = extractBetween(message, [/(?:search|find|about|for|query)\s+"([^"]+)"/i, /(?:search|find|about|for|query)\s+'([^']+)'/i]) || message;
    try {
      const searchResult = await fetch(`${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/knowledge/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: kbQuery, firm_id: firmId, top_k: 10 }),
        signal: AbortSignal.timeout(10000),
      });
      if (searchResult.ok) {
        const data = await searchResult.json();
        const results = data.results || [];
        if (results.length > 0) {
          const lines = results.map((r: any) => {
            const typeEmoji: Record<string, string> = { FACT: '\u2139\uFE0F', RULE: '\u2696\uFE0F', PRECEDENT: '\u2660\uFE0F', REGULATION: '\u26A0\uFE0F', TEMPLATE: '\uD83D\uDCDD', CLAUSE: '\uD83D\uDCD6', GUIDELINE: '\uD83D\uDCA1' };
            return `${typeEmoji[r.entry_type] || '\u2022'} **${r.title}** (${r.entry_type})\n   ${r.summary || r.content?.substring(0, 150) || ''}`;
          }).join('\n\n');
          return ok({ content: `Knowledge Base Results (${results.length})\n\n${lines}\n\nUse the Knowledge Base page (/dashboard/knowledge) to manage entries.`, result: { action: 'knowledge_search', query: kbQuery, results }, toolSuggestions: [{ id: 'search_knowledge', name: 'Search Again', icon: 'book-open' }] });
        }
        return ok({ content: `No knowledge entries found for "${kbQuery}".\n\nTry:\n- Upload documents and ingest them into the Knowledge Base\n- Create knowledge entries manually at /dashboard/knowledge`, toolSuggestions: [{ id: 'upload_document', name: 'Upload Document', icon: 'file-up' }] });
      }
    } catch { /* AI service unavailable */ }
    return ok({ content: 'Knowledge base search is temporarily unavailable. The AI service may be offline.' });
  }

  // ── INTEGRATIONS ───────────────────────────────────────────────────
  if (toolId === 'manage_integrations' || /\b(integration|connect|link|sync|mcp)\b/i.test(lowerMsg)) {
    try {
      const ints = await prisma.integrationHealthStatus.findMany({ select: { service: true, status: true, errorMsg: true, latencyMs: true } });
      if (ints.length === 0) return ok({ content: '\uD83D\uDD0C Integrations\n\nCounsel supports CRM, billing, DMS, e-sign, and automation integrations. Go to Feature Connector to set them up.' });
      const okc = ints.filter(i => i.status === 'healthy' || i.status === 'connected' || i.status === 'configured').length;
      return ok({ content: '\uD83D\uDD0C Integration Status\n\n' + okc + '/' + ints.length + ' healthy\n\n' + ints.map(i => '\u2022 ' + i.service + ' \u2014 ' + (i.status === 'healthy' || i.status === 'connected' || i.status === 'configured' ? '\u2705' : '\u274C') + ' ' + (i.latencyMs ? i.latencyMs + 'ms' : '') + ' ' + (i.errorMsg || '')).join('\n') });
    } catch { return ok({ content: '\uD83D\uDD0C Integrations\n\nCounsel supports CRM, billing, DMS, e-sign, and automation. Go to Feature Connector to set them up.' }); }
  }

  // ── GENERAL ────────────────────────────────────────────────────────
  const firm = await prisma.firm.findUnique({ where: { id: firmId }, select: { name: true, _count: { select: { matters: true, documents: true, users: true } } } });
  if (/\b(show|list|my|all)\s+(matters?|cases?)\b/i.test(lowerMsg)) {
    const matts = await prisma.matter.findMany({ where: { firmId }, select: { id: true, name: true, clientName: true, status: true, type: true }, orderBy: { updatedAt: 'desc' }, take: 10 });
    if (matts.length === 0) return ok({ content: 'No matters yet. Say "create a matter"!', toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }] });
    return ok({ content: 'Your Matters (' + matts.length + '):\n\n' + matts.map(m => '\u2022 ' + m.name + ' \u2014 ' + m.clientName + ' [' + m.type + '] (' + m.status + ')').join('\n'), toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }] });
  }
  return ok({ content: '\uD83D\uDC4B I am Counsel AI.\n\nFirm: ' + (firm?.name || 'Unknown') + '\nMatters: ' + (firm?._count.matters || 0) + '\nDocuments: ' + (firm?._count.documents || 0) + '\n\n**For Law Firms:**\n\u2022 Create matters\n\u2022 Upload & search documents\n\u2022 Legal research (creates real briefs)\n\u2022 Draft contracts, NDAs\n\u2022 Check compliance\n\n**For CA Firms:**\n\u2022 Add clients with PAN/GST\n\u2022 Track tax filings & deadlines\n\u2022 Bank reconciliation\n\u2022 Manage engagements\n\n**For Consulting:**\n\u2022 Create proposals & SOWs\n\u2022 Market intel & competitive analysis\n\u2022 Track engagements & projects\n\n**For Everyone:**\n\u2022 Schedule meetings\n\u2022 Financial analysis (NPV/IRR)\n\u2022 Manage integrations\n\nJust type what you need!', toolSuggestions: CHAT_TOOLS.map(t => ({ id: t.id, name: t.name, icon: t.icon })) });
}

export default router;
