import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

const router = Router();

// ─── Available tools exposed to the chat ─────────────────────────────────────
const CHAT_TOOLS = [
  {
    id: 'create_matter',
    name: 'Create Matter',
    description: 'Open a new legal or consulting matter',
    icon: 'briefcase',
    category: 'work',
  },
  {
    id: 'upload_document',
    name: 'Upload Document',
    description: 'Upload and analyze a document (PDF, DOCX, etc.)',
    icon: 'file-up',
    category: 'documents',
  },
  {
    id: 'search_documents',
    name: 'Search Documents',
    description: 'Semantic search across all firm documents',
    icon: 'search',
    category: 'documents',
  },
  {
    id: 'legal_research',
    name: 'Legal Research',
    description: 'Research case law, statutes, and regulations',
    icon: 'scale',
    category: 'research',
  },
  {
    id: 'draft_document',
    name: 'Draft Document',
    description: 'AI-assisted contract or memo drafting',
    icon: 'edit',
    category: 'drafts',
  },
  {
    id: 'schedule_meeting',
    name: 'Schedule Meeting',
    description: 'Create and manage meetings with clients',
    icon: 'calendar',
    category: 'meetings',
  },
  {
    id: 'check_compliance',
    name: 'Check Compliance',
    description: 'Verify provisions against playbook rules',
    icon: 'shield',
    category: 'compliance',
  },
  {
    id: 'financial_analysis',
    name: 'Financial Analysis',
    description: 'Calculate NPV, IRR, sensitivity analysis',
    icon: 'calculator',
    category: 'analysis',
  },
  {
    id: 'kb_query',
    name: 'Ask Firm Knowledge Base',
    description: 'Query the firm\'s internal knowledge base',
    icon: 'brain',
    category: 'knowledge',
  },
  {
    id: 'manage_integrations',
    name: 'Manage Integrations',
    description: 'Connect CRM, billing, DMS, and other integrations',
    icon: 'plug',
    category: 'integrations',
  },
];

// ─── GET /tools ─── List available chat tools ────────────────────────────────
router.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: CHAT_TOOLS });
});

// ─── POST /message ─── Main chat message handler ────────────────────────────
router.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, toolId, context } = req.body;
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required', code: 'VALIDATION' });
      return;
    }

    // ── Tool-specific handling ──────────────────────────────────────────
    if (toolId) {
      const toolResult = await handleToolDispatch(toolId, message, context, firmId, userId);
      if (toolResult) {
        res.json(toolResult);
        return;
      }
    }

    // ── General AI chat ─────────────────────────────────────────────────
    let aiResponse = null;
    try {
      const aiUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
      const ai = await fetch(`${aiUrl}/agents/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          firmId,
          userId,
          context: {
            toolId: toolId || null,
            ...context,
          },
          tools: CHAT_TOOLS.map(t => ({ id: t.id, name: t.name, description: t.description })),
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (ai.ok) {
        aiResponse = await ai.json();
      }
    } catch {
      // AI service unavailable — fall through to local processing
    }

    if (aiResponse) {
      res.json(aiResponse);
      return;
    }

    // ── Local fallback dispatcher ───────────────────────────────────────
    const localResponse = await localIntentDispatch(message, toolId, firmId, userId);
    res.json(localResponse);
  } catch (err) {
    next(err);
  }
});

// ─── POST /history ─── Save/retrieve conversation history ────────────────────
router.post('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, messages, conversationId } = req.body;
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;

    switch (action) {
      case 'save': {
        if (!messages || !Array.isArray(messages)) {
          res.status(400).json({ error: 'messages array is required', code: 'VALIDATION' });
          return;
        }

        if (conversationId) {
          // Update existing
          const existing = await prisma.chatConversation.findFirst({
            where: { id: conversationId, firmId },
          });
          if (!existing) {
            res.status(404).json({ error: 'Conversation not found' });
            return;
          }
          await prisma.chatConversation.update({
            where: { id: conversationId },
            data: {
              messages: JSON.stringify(messages),
              updatedAt: new Date(),
            },
          });
          res.json({ conversationId });
        } else {
          // Create new
          const firstUserMsg = messages.find((m: any) => m.role === 'user');
          const title = firstUserMsg
            ? (firstUserMsg.text || firstUserMsg.content || '').substring(0, 80)
            : 'New conversation';
          const conv = await prisma.chatConversation.create({
            data: {
              firmId,
              userId,
              title,
              messages: JSON.stringify(messages),
            },
          });
          res.json({ conversationId: conv.id, title });
        }
        break;
      }

      case 'list': {
        const conversations = await prisma.chatConversation.findMany({
          where: { firmId },
          select: {
            id: true,
            title: true,
            updatedAt: true,
            createdAt: true,
          },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        });
        res.json({ conversations });
        break;
      }

      case 'get': {
        if (!conversationId) {
          res.status(400).json({ error: 'conversationId is required' });
          return;
        }
        const conv = await prisma.chatConversation.findFirst({
          where: { id: conversationId, firmId },
        });
        if (!conv) {
          res.status(404).json({ error: 'Conversation not found' });
          return;
        }
        res.json({
          id: conv.id,
          title: conv.title,
          messages: typeof conv.messages === 'string' ? JSON.parse(conv.messages) : conv.messages,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        });
        break;
      }

      case 'delete': {
        if (!conversationId) {
          res.status(400).json({ error: 'conversationId is required' });
          return;
        }
        await prisma.chatConversation.deleteMany({
          where: { id: conversationId, firmId },
        });
        res.json({ deleted: true });
        break;
      }

      default:
        res.status(400).json({ error: 'Invalid action. Use: save, list, get, delete', code: 'VALIDATION' });
    }
  } catch (err) {
    next(err);
  }
});

// ─── Local Intent Dispatch ───────────────────────────────────────────────────
async function localIntentDispatch(
  message: string,
  toolId: string | undefined,
  firmId: string,
  _userId: string | undefined,
) {
  const lowerMsg = message.toLowerCase();

  // ── Matter-related ────────────────────────────────────────────────────
  if (toolId === 'create_matter' || /\b(create|new|open)\s+(a\s+)?(matter|case|file)\b/i.test(lowerMsg)) {
    const matters = await prisma.matter.findMany({
      where: { firmId },
      select: { id: true, name: true, clientName: true, status: true, type: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: matters.length
        ? `I can help you create a new matter. Here are your existing matters for reference:\n\n${matters.map(m => `• **${m.name}** — ${m.clientName} (${m.status})`).join('\n')}\n\nTo create a new matter, just tell me the name, client, and description!`
        : `I can help you create your first matter! Just tell me the name, client, and a brief description of what it's about.`,
      timestamp: new Date().toISOString(),
      actions: [
        { type: 'create_matter', label: 'Create Matter', icon: 'briefcase' },
      ],
      toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }],
    };
  }

  // ── Document-related ──────────────────────────────────────────────────
  if (toolId === 'upload_document' || /\b(upload|add)\s+(a\s+)?(document|file|pdf|contract)\b/i.test(lowerMsg)) {
    const recentDocs = await prisma.document.findMany({
      where: { firmId },
      select: { id: true, originalName: true, mimeType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: recentDocs.length
        ? `You can upload documents directly through the chat! Here are your recently uploaded documents:\n\n${recentDocs.map(d => `• **${d.originalName}** (${d.mimeType.split('/').pop()?.toUpperCase()})`).join('\n')}\n\nClick the paperclip icon or drag & drop a file to upload. I support PDF, DOCX, TXT, and more.`
        : `You can upload documents directly through the chat! Click the paperclip icon or drag & drop a file to get started. I support PDF, DOCX, TXT, images, and more.`,
      timestamp: new Date().toISOString(),
      actions: [{ type: 'upload', label: 'Upload File', icon: 'file-up' }],
      toolSuggestions: [
        { id: 'upload_document', name: 'Upload Document', icon: 'file-up' },
        { id: 'search_documents', name: 'Search Documents', icon: 'search' },
      ],
    };
  }

  // ── Research-related ──────────────────────────────────────────────────
  if (toolId === 'legal_research' || /\b(research|search|find|look\s*up)\s+(about|on|for)?\s*(case\s*)?law|legal\s+(research|analysis)/i.test(lowerMsg)) {
    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `I can help with legal research! Here's what I can do:\n\n🔍 **Search** firm documents, case law, and statutes\n📚 **Analyze** contracts and identify key clauses\n⚖️ **Check compliance** against your firm's playbook rules\n📊 **Summarize** long documents into key points\n\nWhat topic or question would you like me to research?`,
      timestamp: new Date().toISOString(),
      toolSuggestions: [
        { id: 'legal_research', name: 'Legal Research', icon: 'scale' },
        { id: 'search_documents', name: 'Search Documents', icon: 'search' },
        { id: 'check_compliance', name: 'Check Compliance', icon: 'shield' },
      ],
    };
  }

  // ── Draft-related ─────────────────────────────────────────────────────
  if (toolId === 'draft_document' || /\b(draft|write|create)\s+(a\s+)?(contract|agreement|memo|letter|nd(a)?|lease|brief|motion|pleading)/i.test(lowerMsg)) {
    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `I can draft legal documents for you! Here are common document types I can help with:\n\n• 📝 **Contracts** — NDAs, service agreements, employment contracts\n• 📄 **Memos** — internal legal memos, advisory opinions\n• ✉️ **Letters** — demand letters, opinion letters, engagement letters\n• 📑 **Briefs** — case briefs, motion briefs, appellate briefs\n\nWhat type of document and any specific requirements?`,
      timestamp: new Date().toISOString(),
      actions: [{ type: 'draft', label: 'Start Drafting', icon: 'edit' }],
      toolSuggestions: [
        { id: 'draft_document', name: 'Draft Document', icon: 'edit' },
      ],
    };
  }

  // ── Meeting-related ───────────────────────────────────────────────────
  if (toolId === 'schedule_meeting' || /\b(schedule|book|set\s*up)\s+(a\s+)?(meeting|call|appointment)/i.test(lowerMsg)) {
    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `I can help schedule a meeting! To get started, I'll need:\n\n• 📅 Preferred date and time\n• 👥 Who's attending\n• 📋 Meeting topic/agenda\n• 🔗 Related matter (optional)\n\nJust describe what you need and I'll set it up!`,
      timestamp: new Date().toISOString(),
      actions: [{ type: 'schedule', label: 'Schedule Meeting', icon: 'calendar' }],
      toolSuggestions: [{ id: 'schedule_meeting', name: 'Schedule Meeting', icon: 'calendar' }],
    };
  }

  // ── Integration-related ───────────────────────────────────────────────
  if (toolId === 'manage_integrations' || /\b(integration|connect|link|sync|mcp)\b/i.test(lowerMsg)) {
    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: `Counsel integrates with your existing tool stack:\n\n**Available integrations:**\n• 🔗 **CRM** — Salesforce, Clio, HubSpot\n• 💰 **Billing** — QuickBooks, Xero, Zoho Books\n• 📁 **DMS** — iManage, NetDocuments, SharePoint\n• ✍️ **E-Sign** — DocuSign, Adobe Sign\n• 📊 **Analytics** — Power BI, Tableau\n• 🤖 **Automation** — Zapier, Make, n8n\n\nWhich integration would you like to set up?`,
      timestamp: new Date().toISOString(),
      toolSuggestions: [{ id: 'manage_integrations', name: 'Manage Integrations', icon: 'plug' }],
    };
  }

  // ── General / Help ────────────────────────────────────────────────────
  const firmInfo = await prisma.firm.findUnique({
    where: { id: firmId },
    select: {
      name: true,
      _count: { select: { matters: true, documents: true, users: true } },
    },
  });

  return {
    id: `msg_${Date.now()}`,
    role: 'assistant',
    content: `I'm Counsel AI, your firm's intelligent assistant. Here's a quick overview:

**Your firm:** ${firmInfo?.name || 'Unknown'}
**Active matters:** ${firmInfo?._count.matters || 0}
**Documents:** ${firmInfo?._count.documents || 0}
**Team members:** ${firmInfo?._count.users || 0}

**What I can help with:**
• 📋 **Matters** — Create, view, and manage legal matters
• 📄 **Documents** — Upload, search, and analyze contracts
• 🔍 **Research** — Legal research and case law lookup
• ✍️ **Drafts** — AI-powered contract and memo drafting
• 📅 **Meetings** — Schedule and manage client meetings
• 🛡️ **Compliance** — Check against your firm's playbook
• 💰 **Finance** — NPV, IRR calculations and sensitivity analysis
• 🔗 **Integrations** — Connect your existing tools

Just type what you need, or click a tool below!`,
    timestamp: new Date().toISOString(),
    toolSuggestions: CHAT_TOOLS.map(t => ({ id: t.id, name: t.name, icon: t.icon })),
  };
}

// ─── Tool-specific dispatch to platform APIs ────────────────────────────────
async function handleToolDispatch(
  toolId: string,
  message: string,
  context: any,
  firmId: string,
  userId: string | undefined,
): Promise<any> {
  switch (toolId) {
    case 'create_matter': {
      // Extract matter details from message if possible
      const matters = await prisma.matter.findMany({
        where: { firmId },
        select: { id: true, name: true, clientName: true, status: true, type: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: matters.length
          ? `Here are your current matters. To create a new one, tell me:\n\n${matters.map(m => `• **${m.name}** — ${m.clientName} (${m.status})`).join('\n')}\n\nOr fill out the form below:`
          : `Let's create your first matter! Please provide:\n\n• Matter name\n• Client name\n• Brief description\n• Type (Legal or Consulting)`,
        timestamp: new Date().toISOString(),
        form: {
          type: 'create_matter',
          fields: [
            { name: 'name', label: 'Matter Name', type: 'text', required: true },
            { name: 'clientName', label: 'Client Name', type: 'text', required: true },
            { name: 'description', label: 'Description', type: 'textarea', required: false },
            { name: 'type', label: 'Type', type: 'select', options: ['LEGAL', 'CONSULTING'], required: true },
          ],
        },
        toolSuggestions: [{ id: 'create_matter', name: 'Create Matter', icon: 'briefcase' }],
      };
    }

    case 'search_documents': {
      const docs = await prisma.document.findMany({
        where: { firmId },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: docs.length
          ? `Here are your recent documents:\n\n${docs.map(d => `• **${d.originalName}** — ${(d.sizeBytes / 1024).toFixed(1)} KB, uploaded ${new Date(d.createdAt).toLocaleDateString()}`).join('\n')}\n\nWhat would you like to search for? I can search by content, keywords, or document type.`
          : `You don't have any documents yet. Upload one to get started!`,
        timestamp: new Date().toISOString(),
        toolSuggestions: [
          { id: 'upload_document', name: 'Upload Document', icon: 'file-up' },
          { id: 'search_documents', name: 'Search Documents', icon: 'search' },
        ],
      };
    }

    case 'check_compliance': {
      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Compliance check mode activated! Here are the frameworks I can check against:\n\n• 🛡️ **GDPR** — EU data protection\n• 🛡️ **CCPA** — California privacy law\n• 🛡️ **SOC2** — Service organization controls\n• 🛡️ **ISO 27001** — Information security\n• 📋 **Playbook Rules** — Your firm's custom negotiation rules\n\nPaste a clause or describe the provision you want to check, and I'll analyze it against your selected framework.`,
        timestamp: new Date().toISOString(),
        form: {
          type: 'compliance_check',
          fields: [
            { name: 'framework', label: 'Framework', type: 'select', options: ['GDPR', 'CCPA', 'SOC2', 'ISO27001', 'Playbook'], required: true },
            { name: 'clause', label: 'Clause or Provision', type: 'textarea', required: true },
          ],
        },
      };
    }

    case 'financial_analysis': {
      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Financial analysis mode. I can compute:\n\n• 💰 **NPV** (Net Present Value)\n• 📈 **IRR** (Internal Rate of Return)\n• ⏱️ **Payback Period**\n• 📊 **Sensitivity Analysis** (best/worst case)\n\nProvide your cash flows (initial investment + projected returns) and discount rate, and I'll run the numbers.`,
        timestamp: new Date().toISOString(),
        form: {
          type: 'financial_analysis',
          fields: [
            { name: 'cashFlows', label: 'Cash Flows (comma-separated)', type: 'text', placeholder: '-100000, 30000, 40000, 50000', required: true },
            { name: 'discountRate', label: 'Discount Rate', type: 'text', placeholder: '0.10', required: true },
          ],
        },
      };
    }

    default:
      return null;
  }
}

export default router;
