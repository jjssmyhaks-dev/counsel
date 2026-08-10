import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

const router = Router();

const CHAT_TOOLS = [
  { id: 'create_matter', name: 'Create Matter', description: 'Open a new legal or consulting matter', icon: 'briefcase', category: 'work' },
  { id: 'upload_document', name: 'Upload Document', description: 'Upload and analyze a document (PDF, DOCX, etc.)', icon: 'file-up', category: 'documents' },
  { id: 'search_documents', name: 'Search Documents', description: 'Semantic search across all firm documents', icon: 'search', category: 'documents' },
  { id: 'legal_research', name: 'Legal Research', description: 'Research case law, statutes, and regulations', icon: 'scale', category: 'research' },
  { id: 'draft_document', name: 'Draft Document', description: 'AI-assisted contract or memo drafting', icon: 'edit', category: 'drafts' },
  { id: 'schedule_meeting', name: 'Schedule Meeting', description: 'Create and manage meetings with clients', icon: 'calendar', category: 'meetings' },
  { id: 'check_compliance', name: 'Check Compliance', description: 'Verify provisions against playbook rules', icon: 'shield', category: 'compliance' },
  { id: 'financial_analysis', name: 'Financial Analysis', description: 'Calculate NPV, IRR, sensitivity analysis', icon: 'calculator', category: 'analysis' },
  { id: 'kb_query', name: 'Ask Firm Knowledge Base', description: "Query the firm's internal knowledge base", icon: 'brain', category: 'knowledge' },
  { id: 'manage_integrations', name: 'Manage Integrations', description: 'Connect CRM, billing, DMS, and other integrations', icon: 'plug', category: 'integrations' },
];

router.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: CHAT_TOOLS });
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

router.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, toolId, context } = req.body;
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;

    if (!message || typeof message !== 'string') { res.status(400).json({ error: 'message required' }); return; }

    let aiResponse = null;
    try {
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const ai = await fetch(aiUrl + '/agents/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, firmId, userId, context: { toolId: toolId || null, ...context }, tools: CHAT_TOOLS.map(t => ({ id: t.id, name: t.name, description: t.description })) }),
        signal: AbortSignal.timeout(60000),
      });
      if (ai.ok) aiResponse = await ai.json();
    } catch { /* fall through */ }

    if (aiResponse && (aiResponse.content || aiResponse.response)) {
      res.json({ id: aiResponse.id || 'msg_' + Date.now(), role: 'assistant', content: aiResponse.content || aiResponse.response, timestamp: aiResponse.timestamp || new Date().toISOString(), actions: aiResponse.actions, toolSuggestions: aiResponse.toolSuggestions, result: aiResponse.result });
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
        const meeting = await prisma.meeting.create({ data: { firmId, title: mtitle, description: 'Scheduled via Counsel Chat', meetingDate: meetingDate, source: 'MANUAL', durationMinutes: 60, createdById: userId } });
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

  // ── INTEGRATIONS ───────────────────────────────────────────────────
  if (toolId === 'manage_integrations' || /\b(integration|connect|link|sync|mcp)\b/i.test(lowerMsg)) {
    try {
      const ints = await prisma.integrationHealth.findMany({ select: { service: true, status: true, errorMsg: true, latencyMs: true } });
      if (ints.length === 0) return ok({ content: '\uD83D\uDD0C Integrations\n\nCounsel supports CRM, billing, DMS, e-sign, and automation integrations. Go to Feature Connector to set them up.' });
      const okc = ints.filter(i => i.status === 'healthy').length;
      return ok({ content: '\uD83D\uDD0C Integration Status\n\n' + okc + '/' + ints.length + ' healthy\n\n' + ints.map(i => '\u2022 ' + i.service + ' \u2014 ' + (i.status === 'healthy' ? '\u2705' : '\u274C') + ' ' + (i.latencyMs ? i.latencyMs + 'ms' : '') + ' ' + (i.errorMsg || '')).join('\n') });
    } catch { return ok({ content: '\uD83D\uDD0C Integrations\n\nCounsel supports CRM, billing, DMS, e-sign, and automation. Go to Feature Connector to set them up.' }); }
  }

  // ── GENERAL ────────────────────────────────────────────────────────
  const firm = await prisma.firm.findUnique({ where: { id: firmId }, select: { name: true, _count: { select: { matters: true, documents: true, users: true } } } });
  if (/\b(show|list|my|all)\s+(matters?|cases?)\b/i.test(lowerMsg)) {
    const matts = await prisma.matter.findMany({ where: { firmId }, select: { id: true, name: true, clientName: true, status: true, type: true }, orderBy: { updatedAt: 'desc' }, take: 10 });
    if (matts.length === 0) return ok({ content: 'No matters yet. Say "create a matter"!', toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }] });
    return ok({ content: 'Your Matters (' + matts.length + '):\n\n' + matts.map(m => '\u2022 ' + m.name + ' \u2014 ' + m.clientName + ' [' + m.type + '] (' + m.status + ')').join('\n'), toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }] });
  }
  return ok({ content: '\uD83D\uDC4B I am Counsel AI.\n\nFirm: ' + (firm?.name || 'Unknown') + '\nMatters: ' + (firm?._count.matters || 0) + '\nDocuments: ' + (firm?._count.documents || 0) + '\n\nI can:\n\u2022 Create matters\n\u2022 Upload & search documents\n\u2022 Legal research (creates real briefs)\n\u2022 Draft contracts, NDAs\n\u2022 Schedule meetings\n\u2022 Check compliance\n\u2022 Financial analysis (NPV/IRR)\n\u2022 Manage integrations\n\nJust type what you need!', toolSuggestions: CHAT_TOOLS.map(t => ({ id: t.id, name: t.name, icon: t.icon })) });
}

export default router;
