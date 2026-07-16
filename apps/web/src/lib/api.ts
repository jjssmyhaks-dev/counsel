import type {
  Firm,
  User,
  Matter,
  Document,
  Analysis,
  ResearchBrief,
  Draft,
  Meeting,
  MeetingActionItem,
  MeetingDecision,
  KbAnswer,
  KbQueryRequest,
  AuditLog,
  Playbook,
  PlaybookRule,
  LoginRequest,
  LoginResponse,
  PaginatedResponse,
  CreateMatterRequest,
  CreateDraftRequest,
  CreateResearchRequest,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    throw new ApiError(0, 'API calls only available on client', 'SERVER_SIDE');
  }

  const token = localStorage.getItem('counsel_token');

  const headers: Record<string, string> = {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('counsel_token');
      localStorage.removeItem('counsel_user');
      localStorage.removeItem('counsel_firm');
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired', 'UNAUTHORIZED');
    }
    const err = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: res.statusText },
    }));
    throw new ApiError(
      res.status,
      err.error?.message || res.statusText,
      err.error?.code
    );
  }

  return res.json();
}

// ── Mock Data ────────────────────────────────────────────────────

const MOCK_DELAY = () => new Promise((r) => setTimeout(r, 300 + Math.random() * 400));

const MOCK_FIRM: Firm = {
  id: 'firm-001',
  name: 'Sterling & Associates LLP',
  domain: 'sterling-law.com',
  plan: 'professional',
  createdAt: '2024-01-15T08:00:00Z',
  settings: {
    defaultLanguage: 'en',
    timezone: 'America/New_York',
    features: {
      documentAnalysis: true,
      research: true,
      drafting: true,
      knowledgeBase: true,
      meetings: true,
    },
  },
};

const MOCK_USER: User = {
  id: 'user-001',
  email: 'admin@demo-firm.com',
  name: 'Sarah Chen',
  role: 'partner',
  firmId: 'firm-001',
  avatarUrl: '',
  createdAt: '2024-01-15T08:00:00Z',
  lastLoginAt: new Date().toISOString(),
};

const MOCK_MATTERS: Matter[] = [
  {
    id: 'matter-001',
    name: 'In re Quantum Dynamics Merger',
    clientName: 'Quantum Dynamics Inc.',
    description: 'Cross-border merger and acquisition involving regulatory approval in 3 jurisdictions.',
    status: 'active',
    practiceArea: 'Corporate M&A',
    responsibleUserId: 'user-001',
    responsibleUserName: 'Sarah Chen',
    firmId: 'firm-001',
    documentCount: 47,
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-07-12T14:30:00Z',
  },
  {
    id: 'matter-002',
    name: 'Evergreen IP Portfolio Defense',
    clientName: 'Evergreen Technologies',
    description: 'Defending against patent infringement claims across 5 patents.',
    status: 'active',
    practiceArea: 'Intellectual Property',
    responsibleUserId: 'user-001',
    responsibleUserName: 'Sarah Chen',
    firmId: 'firm-001',
    documentCount: 132,
    createdAt: '2026-05-15T09:00:00Z',
    updatedAt: '2026-07-11T16:00:00Z',
  },
  {
    id: 'matter-003',
    name: 'Brighton Commercial Lease Dispute',
    clientName: 'Brighton Properties Ltd.',
    description: 'Commercial lease dispute regarding force majeure clause interpretation.',
    status: 'pending',
    practiceArea: 'Real Estate',
    responsibleUserId: 'user-001',
    responsibleUserName: 'Sarah Chen',
    firmId: 'firm-001',
    documentCount: 23,
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-10T11:00:00Z',
  },
  {
    id: 'matter-004',
    name: 'Thompson Employment Settlement',
    clientName: 'Thompson Industries',
    description: 'Class action employment settlement negotiation.',
    status: 'closed',
    practiceArea: 'Employment Law',
    responsibleUserId: 'user-001',
    responsibleUserName: 'Sarah Chen',
    firmId: 'firm-001',
    documentCount: 89,
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-06-28T09:00:00Z',
  },
  {
    id: 'matter-005',
    name: 'NovaTech Data Privacy Audit',
    clientName: 'NovaTech Solutions',
    description: 'GDPR and CCPA compliance audit for SaaS platform.',
    status: 'active',
    practiceArea: 'Privacy & Data Protection',
    responsibleUserId: 'user-001',
    responsibleUserName: 'Sarah Chen',
    firmId: 'firm-001',
    documentCount: 56,
    createdAt: '2026-06-15T08:00:00Z',
    updatedAt: '2026-07-12T10:00:00Z',
  },
];

const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'doc-001',
    name: 'Quantum Dynamics - Merger Agreement v3.pdf',
    type: 'pdf',
    size: 2450000,
    status: 'ready',
    matterId: 'matter-001',
    matterName: 'In re Quantum Dynamics Merger',
    uploadedBy: 'user-001',
    uploaderName: 'Sarah Chen',
    firmId: 'firm-001',
    pageCount: 87,
    createdAt: '2026-07-10T09:00:00Z',
    updatedAt: '2026-07-10T09:15:00Z',
  },
  {
    id: 'doc-002',
    name: 'Evergreen - Patent Filing US2026-001234.pdf',
    type: 'pdf',
    size: 1800000,
    status: 'processing',
    matterId: 'matter-002',
    matterName: 'Evergreen IP Portfolio Defense',
    uploadedBy: 'user-001',
    uploaderName: 'Sarah Chen',
    firmId: 'firm-001',
    pageCount: 45,
    createdAt: '2026-07-12T08:00:00Z',
    updatedAt: '2026-07-12T08:02:00Z',
  },
  {
    id: 'doc-003',
    name: 'Brighton - Lease Agreement 2024.docx',
    type: 'docx',
    size: 950000,
    status: 'ready',
    matterId: 'matter-003',
    matterName: 'Brighton Commercial Lease Dispute',
    uploadedBy: 'user-001',
    uploaderName: 'Sarah Chen',
    firmId: 'firm-001',
    pageCount: 32,
    createdAt: '2026-07-05T11:00:00Z',
    updatedAt: '2026-07-05T11:10:00Z',
  },
  {
    id: 'doc-004',
    name: 'NovaTech - Data Processing Agreement.pdf',
    type: 'pdf',
    size: 3200000,
    status: 'ready',
    matterId: 'matter-005',
    matterName: 'NovaTech Data Privacy Audit',
    uploadedBy: 'user-001',
    uploaderName: 'Sarah Chen',
    firmId: 'firm-001',
    pageCount: 64,
    createdAt: '2026-07-08T14:00:00Z',
    updatedAt: '2026-07-08T14:20:00Z',
  },
  {
    id: 'doc-005',
    name: 'Thompson - Settlement Agreement Draft.pdf',
    type: 'pdf',
    size: 1500000,
    status: 'uploaded',
    matterId: 'matter-004',
    matterName: 'Thompson Employment Settlement',
    uploadedBy: 'user-001',
    uploaderName: 'Sarah Chen',
    firmId: 'firm-001',
    pageCount: 28,
    createdAt: '2026-07-12T16:00:00Z',
    updatedAt: '2026-07-12T16:00:00Z',
  },
  {
    id: 'doc-006',
    name: 'Quantum - Regulatory Filing SEC.pdf',
    type: 'pdf',
    size: 4100000,
    status: 'failed',
    matterId: 'matter-001',
    matterName: 'In re Quantum Dynamics Merger',
    uploadedBy: 'user-001',
    uploaderName: 'Sarah Chen',
    firmId: 'firm-001',
    pageCount: 120,
    createdAt: '2026-07-11T10:00:00Z',
    updatedAt: '2026-07-11T10:05:00Z',
  },
];

const MOCK_ANALYSES: Record<string, Analysis> = {
  'doc-001': {
    id: 'analysis-001',
    documentId: 'doc-001',
    documentName: 'Quantum Dynamics - Merger Agreement v3.pdf',
    overallRisk: 'medium',
    summary:
      'This merger agreement contains several provisions that warrant attention. Three clauses present medium risk, concerning indemnification scope, change-of-control definitions, and restrictive covenants. The overall structure is standard for cross-border M&A, but specific language in Sections 7.3, 12.1, and 15.4 should be negotiated.',
    status: 'completed',
    createdAt: '2026-07-10T09:30:00Z',
    clauses: [
      {
        id: 'clause-001',
        type: 'Indemnification',
        excerpt:
          'Seller agrees to indemnify and hold harmless Buyer from any and all claims, losses, damages, liabilities, and expenses, including reasonable attorneys fees, arising from any breach of representation, warranty, or covenant...',
        riskLevel: 'high',
        rationale:
          'Broad indemnification language with no cap on liability, no survival period, and no materiality qualifiers. This exposes the seller to unlimited liability for even minor breaches.',
        suggestedEdit:
          'Add a liability cap of 15% of purchase price, a 12-month survival period, and a materiality qualifier for non-fundamental representations.',
        position: { start: 0, end: 500 },
      },
      {
        id: 'clause-002',
        type: 'Change of Control',
        excerpt:
          'For purposes of this Agreement, a "Change of Control" shall be deemed to occur if any person or group acquires beneficial ownership of 15% or more of the outstanding voting securities...',
        riskLevel: 'medium',
        rationale:
          'The 15% threshold is unusually low compared to market standard of 50%. This could trigger change-of-control provisions unnecessarily through routine stock purchases.',
        suggestedEdit:
          'Revise threshold to 50% or align with standard definition referencing majority board composition changes.',
        position: { start: 500, end: 800 },
      },
      {
        id: 'clause-003',
        type: 'Restrictive Covenant',
        excerpt:
          'For a period of five (5) years following the Closing Date, Seller shall not, directly or indirectly, engage in any business that competes with the business of the Company...',
        riskLevel: 'medium',
        rationale:
          'Five-year non-compete is longer than typical market standard of 2-3 years and may be unenforceable in certain jurisdictions including California.',
        suggestedEdit:
          'Reduce duration to 3 years and narrow scope to specific competitive activities within the same geographic markets.',
        position: { start: 800, end: 1100 },
      },
      {
        id: 'clause-004',
        type: 'Governing Law',
        excerpt:
          'This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflicts of law principles.',
        riskLevel: 'low',
        rationale:
          'Standard Delaware governing law provision. Delaware corporate law is well-developed and predictable. No material changes recommended.',
        suggestedEdit: 'No changes recommended. Provision is market standard.',
        position: { start: 1100, end: 1300 },
      },
      {
        id: 'clause-005',
        type: 'Termination Fee',
        excerpt:
          'In the event this Agreement is terminated under Section 9.2, the terminating party shall pay a termination fee of $5,000,000 (the "Termination Fee") to the other party within five business days.',
        riskLevel: 'low',
        rationale:
          'Standard reverse termination fee structure. Amount represents approximately 3.5% of deal value, which is within market range.',
        suggestedEdit: 'No changes recommended. Consider adding specific triggering events for clarity.',
        position: { start: 1300, end: 1550 },
      },
    ],
  },
  'doc-003': {
    id: 'analysis-002',
    documentId: 'doc-003',
    documentName: 'Brighton - Lease Agreement 2024.docx',
    overallRisk: 'high',
    summary:
      'This lease agreement contains several problematic clauses. The force majeure provision is ambiguously worded and may not provide adequate protection. Rent escalation and maintenance responsibility clauses also require revision.',
    status: 'completed',
    createdAt: '2026-07-05T11:30:00Z',
    clauses: [
      {
        id: 'clause-101',
        type: 'Force Majeure',
        excerpt:
          'Neither party shall be liable for any failure or delay in performance under this Lease due to causes beyond their reasonable control, including but not limited to acts of God, war, terrorism, or government action.',
        riskLevel: 'high',
        rationale:
          'Ambiguous force majeure clause does not specify whether rent obligations are suspended during such events. Tenant may remain liable for rent even if premises are unusable.',
        suggestedEdit:
          'Explicitly state that rent obligations are abated during any period where the premises are rendered unusable due to force majeure events lasting more than 7 days.',
        position: { start: 0, end: 400 },
      },
      {
        id: 'clause-102',
        type: 'Rent Escalation',
        excerpt:
          'Base Rent shall increase by 5% annually on each anniversary of the Commencement Date, compounded.',
        riskLevel: 'high',
        rationale:
          '5% compounded annual increase significantly exceeds market rates for comparable properties. Over a 10-year term, this would result in a 63% rent increase.',
        suggestedEdit:
          'Reduce escalation to 3% simple (not compounded) or tie increases to CPI with a cap of 4%.',
        position: { start: 400, end: 650 },
      },
      {
        id: 'clause-103',
        type: 'Maintenance Responsibilities',
        excerpt:
          'Tenant shall be responsible for all repairs and maintenance of the Premises, including structural elements, roof, HVAC systems, and all mechanical and electrical systems.',
        riskLevel: 'medium',
        rationale:
          'Shifting all maintenance including structural repairs to tenant is atypical for commercial leases and could result in unexpected major expenses.',
        suggestedEdit:
          'Limit tenant maintenance to interior non-structural items. Landlord should retain responsibility for structural elements, roof, and major building systems.',
        position: { start: 650, end: 950 },
      },
    ],
  },
};

const MOCK_DRAFTS: Draft[] = [
  {
    id: 'draft-001',
    title: 'Demand Letter - Quantum Merger Counterparty',
    type: 'letter',
    status: 'draft',
    content: '',
    instructions: 'Demand letter regarding the indemnification clause dispute in the Quantum merger agreement.',
    matterId: 'matter-001',
    matterName: 'In re Quantum Dynamics Merger',
    createdBy: 'user-001',
    createdAt: '2026-07-10T15:00:00Z',
    updatedAt: '2026-07-10T15:00:00Z',
  },
  {
    id: 'draft-002',
    title: 'Patent Invalidity Analysis Memo',
    type: 'memo',
    status: 'finalized',
    content:
      'MEMORANDUM\n\nTO: File\nFROM: Sarah Chen\nDATE: July 11, 2026\nRE: Patent Invalidity Analysis – Evergreen Technologies\n\nThis memo summarizes our analysis of the five asserted patents in the Evergreen IP defense matter...',
    instructions: 'Memo analyzing prior art for Evergreen patent defense.',
    matterId: 'matter-002',
    matterName: 'Evergreen IP Portfolio Defense',
    createdBy: 'user-001',
    createdAt: '2026-07-09T09:00:00Z',
    updatedAt: '2026-07-11T14:00:00Z',
  },
  {
    id: 'draft-003',
    title: 'Client Update Email - Brighton Dispute',
    type: 'email',
    status: 'draft',
    content: '',
    instructions: 'Update Brighton Properties on the force majeure analysis and next steps.',
    matterId: 'matter-003',
    matterName: 'Brighton Commercial Lease Dispute',
    createdBy: 'user-001',
    createdAt: '2026-07-12T10:00:00Z',
    updatedAt: '2026-07-12T10:00:00Z',
  },
  {
    id: 'draft-004',
    title: 'NovaTech GDPR Compliance Report',
    type: 'report',
    status: 'generating',
    content: '',
    instructions: 'Generate a comprehensive GDPR compliance assessment report for NovaTech.',
    matterId: 'matter-005',
    matterName: 'NovaTech Data Privacy Audit',
    createdBy: 'user-001',
    createdAt: '2026-07-12T11:00:00Z',
    updatedAt: '2026-07-12T11:01:00Z',
  },
];

const MOCK_RESEARCH: ResearchBrief[] = [
  {
    id: 'research-001',
    title: 'Delaware Merger Agreement Precedent Review',
    query: 'Recent Delaware case law on indemnification caps in merger agreements and enforceability of non-compete provisions exceeding 3 years',
    status: 'completed',
    matterId: 'matter-001',
    matterName: 'In re Quantum Dynamics Merger',
    sources: ['Del. Ch. C.A. No. 2025-0923', 'ABA M&A Committee Report 2026', 'Practical Law - Indemnification Caps Survey'],
    findings:
      'Research identified 12 relevant Delaware Chancery Court decisions from 2024-2026. The prevailing trend supports enforceability of indemnification caps tied to a percentage of purchase price...',
    requestedBy: 'user-001',
    createdAt: '2026-07-10T16:00:00Z',
    updatedAt: '2026-07-10T16:45:00Z',
  },
  {
    id: 'research-002',
    title: 'FRCP Amendments Impact on E-Discovery',
    query: 'How do the 2025 FRCP amendments affect e-discovery obligations in patent litigation?',
    status: 'researching',
    matterId: 'matter-002',
    matterName: 'Evergreen IP Portfolio Defense',
    sources: [],
    findings: '',
    requestedBy: 'user-001',
    createdAt: '2026-07-12T09:00:00Z',
    updatedAt: '2026-07-12T09:01:00Z',
  },
  {
    id: 'research-003',
    title: 'Commercial Lease Force Majeure in NY',
    query: 'New York commercial lease force majeure clause interpretation post-pandemic, focusing on rent abatement during untenantability',
    status: 'completed',
    matterId: 'matter-003',
    matterName: 'Brighton Commercial Lease Dispute',
    sources: ['NY Ct. App. 2025-1021', 'NY Real Property Law § 227', 'NYLJ Survey 2025'],
    findings:
      'New York courts have increasingly required explicit language for rent abatement during force majeure events. The leading case, 159 MP Corp. v. Redbridge Bedford, established that generalized force majeure language is insufficient...',
    requestedBy: 'user-001',
    createdAt: '2026-07-06T10:00:00Z',
    updatedAt: '2026-07-06T11:30:00Z',
  },
];

const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'meeting-001',
    title: 'Quantum Merger Strategy Session',
    date: '2026-07-12T10:00:00Z',
    duration: 90,
    participants: ['Sarah Chen', 'Michael Torres (Partner)', 'Lisa Park (Associate)'],
    status: 'completed',
    actionItemsCount: 7,
    decisionsCount: 3,
    matterId: 'matter-001',
    matterName: 'In re Quantum Dynamics Merger',
    summary:
      'Strategy session to review the merger agreement analysis and plan negotiation approach. Key focus areas: indemnification caps, change-of-control threshold, and restructuring the termination fee structure.',
    createdAt: '2026-07-12T10:00:00Z',
  },
  {
    id: 'meeting-002',
    title: 'Evergreen Patent Claim Construction',
    date: '2026-07-11T14:00:00Z',
    duration: 120,
    participants: ['Sarah Chen', 'Dr. Robert Kim (Tech Expert)', 'Jennifer Walsh (Partner)'],
    status: 'completed',
    actionItemsCount: 12,
    decisionsCount: 5,
    matterId: 'matter-002',
    matterName: 'Evergreen IP Portfolio Defense',
    summary:
      'Detailed claim construction analysis with technical expert. Identified key prior art references and developed non-infringement arguments for three of the five asserted patents.',
    createdAt: '2026-07-11T14:00:00Z',
  },
  {
    id: 'meeting-003',
    title: 'Brighton Lease Strategy Call',
    date: '2026-07-13T15:00:00Z',
    duration: 60,
    participants: ['Sarah Chen', 'Brighton Properties - James Wilson'],
    status: 'scheduled',
    actionItemsCount: 0,
    decisionsCount: 0,
    matterId: 'matter-003',
    matterName: 'Brighton Commercial Lease Dispute',
    createdAt: '2026-07-12T17:00:00Z',
  },
  {
    id: 'meeting-004',
    title: 'NovaTech DPA Review',
    date: '2026-07-09T11:00:00Z',
    duration: 75,
    participants: ['Sarah Chen', 'NovaTech Legal Team'],
    status: 'completed',
    actionItemsCount: 5,
    decisionsCount: 2,
    matterId: 'matter-005',
    matterName: 'NovaTech Data Privacy Audit',
    summary:
      'Reviewed data processing agreement for GDPR compliance gaps. Identified 8 areas requiring remediation, prioritized by risk level.',
    createdAt: '2026-07-09T11:00:00Z',
  },
];

const MOCK_ACTION_ITEMS: MeetingActionItem[] = [
  {
    id: 'ai-001',
    meetingId: 'meeting-001',
    description: 'Draft revised indemnification clause with 15% cap and 12-month survival period',
    owner: 'Sarah Chen',
    dueDate: '2026-07-15T17:00:00Z',
    status: 'in_progress',
    createdAt: '2026-07-12T11:30:00Z',
  },
  {
    id: 'ai-002',
    meetingId: 'meeting-001',
    description: 'Research Delaware case law on non-compete enforceability for selling shareholders',
    owner: 'Lisa Park',
    dueDate: '2026-07-14T17:00:00Z',
    status: 'completed',
    createdAt: '2026-07-12T11:30:00Z',
  },
  {
    id: 'ai-003',
    meetingId: 'meeting-001',
    description: 'Prepare term sheet comparison for client review',
    owner: 'Sarah Chen',
    dueDate: '2026-07-16T17:00:00Z',
    status: 'pending',
    createdAt: '2026-07-12T11:30:00Z',
  },
  {
    id: 'ai-004',
    meetingId: 'meeting-001',
    description: 'Schedule call with opposing counsel to discuss open points',
    owner: 'Michael Torres',
    dueDate: '2026-07-14T12:00:00Z',
    status: 'overdue',
    createdAt: '2026-07-12T11:30:00Z',
  },
];

const MOCK_DECISIONS: MeetingDecision[] = [
  {
    id: 'dec-001',
    meetingId: 'meeting-001',
    description: 'Negotiate for 15% indemnification cap tied to purchase price, with basket threshold of 1%.',
    rationale: 'Aligns with market precedent and provides reasonable protection while keeping deal attractive.',
    decidedBy: 'Sarah Chen',
    createdAt: '2026-07-12T11:15:00Z',
  },
  {
    id: 'dec-002',
    meetingId: 'meeting-001',
    description: 'Non-compete to be reduced to 3 years with geographic scope limited to existing markets.',
    rationale: '5 years is unlikely to be enforceable in multiple jurisdictions; 3 years is the market maximum.',
    decidedBy: 'Sarah Chen',
    createdAt: '2026-07-12T11:20:00Z',
  },
  {
    id: 'dec-003',
    meetingId: 'meeting-001',
    description: 'Accept current termination fee structure with added specificity on triggering events.',
    rationale: 'Fee amount is within market range. Focus negotiation on clearer trigger definitions rather than amount.',
    decidedBy: 'Consensus',
    createdAt: '2026-07-12T11:25:00Z',
  },
];

const MOCK_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'document.upload',
    resource: 'document',
    resourceId: 'doc-005',
    details: 'Uploaded Thompson - Settlement Agreement Draft.pdf',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-12T16:00:00Z',
    firmId: 'firm-001',
  },
  {
    id: 'log-002',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'document.analyze',
    resource: 'document',
    resourceId: 'doc-001',
    details: 'Requested analysis for Quantum Dynamics Merger Agreement',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-10T09:15:00Z',
    firmId: 'firm-001',
  },
  {
    id: 'log-003',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'research.create',
    resource: 'research',
    resourceId: 'research-001',
    details: 'Created research brief: Delaware Merger Agreement Precedent Review',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-10T16:00:00Z',
    firmId: 'firm-001',
  },
  {
    id: 'log-004',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'draft.create',
    resource: 'draft',
    resourceId: 'draft-001',
    details: 'Created draft: Demand Letter - Quantum Merger Counterparty',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-10T15:00:00Z',
    firmId: 'firm-001',
  },
  {
    id: 'log-005',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'draft.finalize',
    resource: 'draft',
    resourceId: 'draft-002',
    details: 'Finalized: Patent Invalidity Analysis Memo',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-11T14:00:00Z',
    firmId: 'firm-001',
  },
  {
    id: 'log-006',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'kb.query',
    resource: 'kb',
    resourceId: 'kb-query-001',
    details: 'KB Query: "What is our standard indemnification language for M&A?"',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-12T10:30:00Z',
    firmId: 'firm-001',
  },
  {
    id: 'log-007',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'meeting.create',
    resource: 'meeting',
    resourceId: 'meeting-003',
    details: 'Scheduled: Brighton Lease Strategy Call',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-12T17:00:00Z',
    firmId: 'firm-001',
  },
  {
    id: 'log-008',
    userId: 'user-001',
    userName: 'Sarah Chen',
    action: 'auth.login',
    resource: 'auth',
    resourceId: 'user-001',
    details: 'User login',
    ipAddress: '192.168.1.100',
    createdAt: '2026-07-13T01:30:00Z',
    firmId: 'firm-001',
  },
];

const MOCK_PLAYBOOK_RULES: PlaybookRule[] = [
  {
    id: 'rule-001',
    name: 'Indemnification Cap',
    description: 'Ensure indemnification clauses have reasonable liability caps tied to purchase price.',
    riskLevel: 'high',
    clauseType: 'Indemnification',
    criteria: 'No cap or cap exceeds 20% of purchase price; no basket/deductible threshold; no survival period specified.',
    recommendedAction: 'Flag for negotiation. Recommend cap of 10-15%, 1% basket threshold, 12-month survival period.',
    examples: ['Seller shall indemnify... for any and all claims... — FLAG', "Seller's aggregate liability shall not exceed 15% of Purchase Price... — PASS"],
    enabled: true,
  },
  {
    id: 'rule-002',
    name: 'Non-compete Duration',
    description: 'Non-compete duration should not exceed 3 years and should be geographically scoped.',
    riskLevel: 'medium',
    clauseType: 'Restrictive Covenant',
    criteria: 'Duration exceeds 3 years, unlimited geographic scope, or covers all business activities.',
    recommendedAction: 'Negotiate down to 2-3 years with specific geographic and scope limitations.',
    examples: ['For a period of 5 years... shall not engage in any competing business... — FLAG', 'For 2 years within North America... shall not engage in [specified] business... — PASS'],
    enabled: true,
  },
  {
    id: 'rule-003',
    name: 'Force Majeure Rent Abatement',
    description: 'Force majeure clauses in leases should address rent obligations during untenantability.',
    riskLevel: 'high',
    clauseType: 'Force Majeure',
    criteria: 'No explicit rent abatement provision; ambiguous language on obligations during force majeure.',
    recommendedAction: 'Require explicit rent abatement language for periods where premises are unusable.',
    examples: ['Neither party shall be liable for failure... due to causes beyond control... — FLAG if silent on rent', 'Rent shall abate during any period premises are rendered untenantable... — PASS'],
    enabled: true,
  },
  {
    id: 'rule-004',
    name: 'Governing Law Preference',
    description: 'Commercial agreements should use Delaware or New York governing law.',
    riskLevel: 'low',
    clauseType: 'Governing Law',
    criteria: 'Non-standard governing law (other than DE or NY for commercial agreements).',
    recommendedAction: 'Suggest Delaware governing law as market standard for commercial contracts.',
    examples: ['Governed by laws of [non-DE/NY state] — SUGGEST CHANGE', 'Governed by laws of Delaware — PASS'],
    enabled: true,
  },
  {
    id: 'rule-005',
    name: 'Data Privacy - Subprocessors',
    description: 'DPAs must include subprocessor notification and objection rights.',
    riskLevel: 'high',
    clauseType: 'Data Processing',
    criteria: 'No subprocessor list, no notification obligation, no objection right.',
    recommendedAction: 'Require list of subprocessors, 30-day advance notification of changes, and right to object.',
    examples: ['Processor may engage subprocessors at its discretion... — FLAG', 'Processor shall maintain list of subprocessors and provide 30 days notice of changes... — PASS'],
    enabled: true,
  },
];

// ── API Client ──────────────────────────────────────────────────

function shouldUseMock(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem('counsel_use_mock') === 'true';
}

export const api = {
  get: async <T>(path: string): Promise<T> => {
    try {
      return await request<T>(path);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      if (err instanceof TypeError || (err instanceof ApiError && err.status === 0)) {
        localStorage.setItem('counsel_use_mock', 'true');
      }
      // Auto-fallback to mock data when API is unavailable
      const mock = getMockResponse<T>(path);
      if (mock !== undefined) return mock;
      throw err;
    }
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    try {
      return await request<T>(path, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      if (err instanceof TypeError || (err instanceof ApiError && err.status === 0)) {
        localStorage.setItem('counsel_use_mock', 'true');
      }
      const mock = getMockResponse<T>(path, body);
      if (mock !== undefined) return mock;
      throw err;
    }
  },

  patch: async <T>(path: string, body: unknown): Promise<T> => {
    try {
      return await request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      if (err instanceof TypeError || (err instanceof ApiError && err.status === 0)) {
        localStorage.setItem('counsel_use_mock', 'true');
      }
      throw err;
    }
  },

  delete: async <T>(path: string): Promise<T> => {
    try {
      return await request<T>(path, { method: 'DELETE' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SERVER_SIDE') throw err;
      if (err instanceof TypeError || (err instanceof ApiError && err.status === 0)) {
        localStorage.setItem('counsel_use_mock', 'true');
      }
      throw err;
    }
  },

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    try {
      const token = localStorage.getItem('counsel_token');
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('counsel_token');
          window.location.href = '/login';
          throw new ApiError(401, 'Session expired', 'UNAUTHORIZED');
        }
        throw new ApiError(res.status, 'Upload failed');
      }
      return res.json();
    } catch (err) {
      if (err instanceof ApiError) throw err;
      localStorage.setItem('counsel_use_mock', 'true');
      throw err;
    }
  },
};

// ── Mock Fallback Router ─────────────────────────────────────────

function getMockResponse<T>(path: string, body?: unknown): T | undefined {
  // GET routes
  if (path === '/matters') return mockGetMatters() as unknown as T;
  if (path.startsWith('/matters/')) {
    const id = path.split('/matters/')[1];
    return mockGetMatter(id) as unknown as T;
  }
  if (path === '/documents') return mockGetDocuments() as unknown as T;
  if (path.startsWith('/documents/') && path.includes('/analysis')) {
    const id = path.split('/documents/')[1].split('/analysis')[0];
    return mockGetAnalysis(id) as unknown as T;
  }
  if (path.startsWith('/documents/')) {
    const id = path.split('/documents/')[1];
    return mockGetDocument(id) as unknown as T;
  }
  if (path === '/drafts') return mockGetDrafts() as unknown as T;
  if (path.startsWith('/drafts/')) {
    const id = path.split('/drafts/')[1];
    return mockGetDraft(id) as unknown as T;
  }
  if (path === '/research') return mockGetResearch() as unknown as T;
  if (path.startsWith('/research/')) {
    const id = path.split('/research/')[1];
    return mockGetResearchBrief(id) as unknown as T;
  }
  if (path === '/meetings') return mockGetMeetings() as unknown as T;
  if (path.startsWith('/meetings/')) {
    const id = path.split('/meetings/')[1];
    return mockGetMeeting(id) as unknown as T;
  }
  if (path === '/kb/history') return mockGetAuditLogs() as unknown as T;
  if (path === '/playbook/rules') return mockGetPlaybookRules() as unknown as T;
  if (path === '/admin/users') return mockGetUsers() as unknown as T;
  if (path === '/admin/audit') return mockGetAuditLogs() as unknown as T;

  // POST routes
  if (path === '/drafts' && body) {
    const b = body as CreateDraftRequest;
    return mockCreateDraft(b) as unknown as T;
  }
  if (path === '/research' && body) {
    const b = body as CreateResearchRequest;
    return mockCreateResearch(b) as unknown as T;
  }
  if (path === '/kb/query' && body) {
    const b = body as KbQueryRequest;
    return mockKbQuery(b) as unknown as T;
  }
  if (path === '/matters' && body) {
    return mockCreateMatter(body as CreateMatterRequest) as unknown as T;
  }
  if (path.startsWith('/meetings/') && path.endsWith('/action-items')) {
    const id = path.split('/meetings/')[1].split('/action-items')[0];
    return mockGetActionItems(id) as unknown as T;
  }
  if (path.startsWith('/meetings/') && path.endsWith('/decisions')) {
    const id = path.split('/meetings/')[1].split('/decisions')[0];
    return mockGetDecisions(id) as unknown as T;
  }

  return undefined;
}

// ── Mock API Functions ──────────────────────────────────────────

export async function mockLogin(req: LoginRequest): Promise<LoginResponse> {
  await MOCK_DELAY();
  if (req.email === 'admin@demo-firm.com' && req.password === 'password') {
    const resp: LoginResponse = { token: 'demo-token-jwt-mock', user: MOCK_USER, firm: MOCK_FIRM };
    localStorage.setItem('counsel_token', resp.token);
    localStorage.setItem('counsel_user', JSON.stringify(resp.user));
    localStorage.setItem('counsel_firm', JSON.stringify(resp.firm));
    return resp;
  }
  throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
}

export async function mockGetMatters(): Promise<PaginatedResponse<Matter>> {
  await MOCK_DELAY();
  return { data: MOCK_MATTERS, total: MOCK_MATTERS.length, page: 1, pageSize: 20, totalPages: 1 };
}

export async function mockGetMatter(id: string): Promise<Matter> {
  await MOCK_DELAY();
  const matter = MOCK_MATTERS.find((m) => m.id === id);
  if (!matter) throw new ApiError(404, 'Matter not found', 'NOT_FOUND');
  return matter;
}

export async function mockCreateMatter(data: CreateMatterRequest): Promise<Matter> {
  await MOCK_DELAY();
  const matter: Matter = {
    id: `matter-${Date.now()}`,
    ...data,
    status: 'pending',
    responsibleUserName: 'Sarah Chen',
    firmId: 'firm-001',
    documentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return matter;
}

export async function mockGetDocuments(): Promise<PaginatedResponse<Document>> {
  await MOCK_DELAY();
  return { data: MOCK_DOCUMENTS, total: MOCK_DOCUMENTS.length, page: 1, pageSize: 20, totalPages: 1 };
}

export async function mockGetDocument(id: string): Promise<Document> {
  await MOCK_DELAY();
  const doc = MOCK_DOCUMENTS.find((d) => d.id === id);
  if (!doc) throw new ApiError(404, 'Document not found', 'NOT_FOUND');
  return doc;
}

export async function mockGetAnalysis(documentId: string): Promise<Analysis> {
  await MOCK_DELAY();
  const analysis = MOCK_ANALYSES[documentId];
  if (!analysis) throw new ApiError(404, 'Analysis not found', 'NOT_FOUND');
  return analysis;
}

export async function mockGetDrafts(): Promise<PaginatedResponse<Draft>> {
  await MOCK_DELAY();
  return { data: MOCK_DRAFTS, total: MOCK_DRAFTS.length, page: 1, pageSize: 20, totalPages: 1 };
}

export async function mockGetDraft(id: string): Promise<Draft> {
  await MOCK_DELAY();
  const draft = MOCK_DRAFTS.find((d) => d.id === id);
  if (!draft) throw new ApiError(404, 'Draft not found', 'NOT_FOUND');
  return draft;
}

export async function mockCreateDraft(data: CreateDraftRequest): Promise<Draft> {
  await MOCK_DELAY();
  const draft: Draft = {
    id: `draft-${Date.now()}`,
    title: data.title,
    type: data.type,
    status: 'draft',
    content: '',
    instructions: data.instructions,
    matterId: data.matterId,
    matterName: MOCK_MATTERS.find((m) => m.id === data.matterId)?.name || '',
    createdBy: 'user-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return draft;
}

export async function mockGetResearch(): Promise<PaginatedResponse<ResearchBrief>> {
  await MOCK_DELAY();
  return { data: MOCK_RESEARCH, total: MOCK_RESEARCH.length, page: 1, pageSize: 20, totalPages: 1 };
}

export async function mockGetResearchBrief(id: string): Promise<ResearchBrief> {
  await MOCK_DELAY();
  const brief = MOCK_RESEARCH.find((r) => r.id === id);
  if (!brief) throw new ApiError(404, 'Research brief not found', 'NOT_FOUND');
  return brief;
}

export async function mockCreateResearch(data: CreateResearchRequest): Promise<ResearchBrief> {
  await MOCK_DELAY();
  const brief: ResearchBrief = {
    id: `research-${Date.now()}`,
    title: data.title,
    query: data.query,
    status: 'pending',
    matterId: data.matterId,
    matterName: MOCK_MATTERS.find((m) => m.id === data.matterId)?.name || '',
    sources: data.sources,
    findings: '',
    requestedBy: 'user-001',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return brief;
}

export async function mockGetMeetings(): Promise<PaginatedResponse<Meeting>> {
  await MOCK_DELAY();
  return { data: MOCK_MEETINGS, total: MOCK_MEETINGS.length, page: 1, pageSize: 20, totalPages: 1 };
}

export async function mockGetMeeting(id: string): Promise<Meeting> {
  await MOCK_DELAY();
  const meeting = MOCK_MEETINGS.find((m) => m.id === id);
  if (!meeting) throw new ApiError(404, 'Meeting not found', 'NOT_FOUND');
  return meeting;
}

export async function mockGetActionItems(meetingId: string): Promise<MeetingActionItem[]> {
  await MOCK_DELAY();
  return MOCK_ACTION_ITEMS.filter((ai) => ai.meetingId === meetingId);
}

export async function mockGetDecisions(meetingId: string): Promise<MeetingDecision[]> {
  await MOCK_DELAY();
  return MOCK_DECISIONS.filter((d) => d.meetingId === meetingId);
}

export async function mockKbQuery(req: KbQueryRequest): Promise<KbAnswer> {
  await MOCK_DELAY();
  const q = req.question.toLowerCase();

  if (q.includes('indemnif')) {
    return {
      answer:
        'Our standard indemnification language for M&A transactions includes a liability cap of 10-15% of purchase price, a 1% basket threshold (meaning claims must exceed 1% of purchase price before indemnification applies), and a 12-month survival period for general representations. For fundamental representations (e.g., organization, authority, capitalization), we recommend a longer survival period or no cap. See the playbook rule "Indemnification Cap" for detailed criteria.',
      confidence: 'high',
      sources: [
        { id: 'src-1', title: 'M&A Playbook - Indemnification', documentId: 'playbook-001', excerpt: 'Standard indemnification language with 15% cap...', pageNumber: 42 },
        { id: 'src-2', title: 'Quantum Merger Agreement v3', documentId: 'doc-001', excerpt: 'Seller agrees to indemnify...', pageNumber: 23 },
      ],
      metadata: {},
    };
  }

  if (q.includes('non-compete') || q.includes('noncompete')) {
    return {
      answer:
        'Our firm standard for non-compete clauses is a maximum duration of 3 years with geographic and scope limitations specific to the acquired business. For founder/selling shareholders, we may accept slightly broader language, but always limited to the specific industry. Courts in several jurisdictions (particularly California, though Delaware allows reasonable restraints) have shown increased scrutiny of non-competes exceeding 2-3 years. See playbook rule "Non-compete Duration" for guidelines.',
      confidence: 'high',
      sources: [
        { id: 'src-3', title: 'Employment & Restrictive Covenant Playbook', documentId: 'playbook-002', excerpt: 'Non-compete duration guide...', pageNumber: 15 },
        { id: 'src-4', title: 'Quantum Merger Agreement v3', documentId: 'doc-001', excerpt: 'For a period of five (5) years...', pageNumber: 31 },
      ],
      metadata: {},
    };
  }

  if (q.includes('force majeure') || q.includes('lease')) {
    return {
      answer:
        'For commercial lease force majeure clauses, our firm position is that the clause must explicitly address rent obligations during periods of untenantability. General force majeure language without rent-specific provisions is insufficient—New York courts have consistently required explicit language for rent abatement. We recommend adding language such as: "Rent shall abate during any period the premises are rendered untenantable due to a force majeure event that continues for more than 7 consecutive days."',
      confidence: 'high',
      sources: [
        { id: 'src-5', title: 'Real Estate Playbook - Force Majeure', documentId: 'playbook-003', excerpt: 'Force majeure and rent abatement...', pageNumber: 8 },
        { id: 'src-6', title: 'Brighton Lease Agreement 2024', documentId: 'doc-003', excerpt: 'Neither party shall be liable...', pageNumber: 5 },
      ],
      metadata: {},
    };
  }

  if (q.includes('firm policy') || q.includes('billing') || q.includes('hourly')) {
    return {
      answer:
        'Our standard billing rates for 2026 range from $350/hr for junior associates to $850/hr for senior partners. We offer alternative fee arrangements (flat fee, capped fee, success fee) for certain practice areas. All engagement letters should include our standard terms and conditions as set forth in the firm-wide engagement letter template (Document ID: TEMPLATE-EL-2026).',
      confidence: 'medium',
      sources: [
        { id: 'src-7', title: 'Firm Policy Manual 2026', documentId: 'policy-001', excerpt: 'Billing rates and policies...', pageNumber: 22 },
      ],
      metadata: {},
    };
  }

  // Low confidence fallback
  return {
    answer: '',
    confidence: 'low',
    sources: [],
    metadata: { message: 'No confident match found in the knowledge base. Try rephrasing your question or consult the relevant playbook.' },
  };
}

export async function mockGetAuditLogs(): Promise<PaginatedResponse<AuditLog>> {
  await MOCK_DELAY();
  return { data: MOCK_AUDIT_LOGS, total: MOCK_AUDIT_LOGS.length, page: 1, pageSize: 20, totalPages: 1 };
}

export async function mockGetPlaybookRules(): Promise<PlaybookRule[]> {
  await MOCK_DELAY();
  return MOCK_PLAYBOOK_RULES;
}

export async function mockGetUsers(): Promise<PaginatedResponse<User>> {
  await MOCK_DELAY();
  const users: User[] = [
    MOCK_USER,
    {
      id: 'user-002',
      email: 'michael.torres@sterling-law.com',
      name: 'Michael Torres',
      role: 'partner',
      firmId: 'firm-001',
      createdAt: '2024-01-20T08:00:00Z',
      lastLoginAt: '2026-07-12T09:00:00Z',
    },
    {
      id: 'user-003',
      email: 'lisa.park@sterling-law.com',
      name: 'Lisa Park',
      role: 'associate',
      firmId: 'firm-001',
      createdAt: '2025-03-10T08:00:00Z',
      lastLoginAt: '2026-07-12T14:00:00Z',
    },
    {
      id: 'user-004',
      email: 'james.wilson@sterling-law.com',
      name: 'James Wilson',
      role: 'paralegal',
      firmId: 'firm-001',
      createdAt: '2025-06-01T08:00:00Z',
      lastLoginAt: '2026-07-11T10:00:00Z',
    },
    {
      id: 'user-005',
      email: 'david.kim@sterling-law.com',
      name: 'David Kim',
      role: 'viewer',
      firmId: 'firm-001',
      createdAt: '2026-01-15T08:00:00Z',
      lastLoginAt: '2026-07-10T16:00:00Z',
    },
  ];
  return { data: users, total: users.length, page: 1, pageSize: 20, totalPages: 1 };
}
