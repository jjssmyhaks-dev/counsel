// ─── Counsel Platform – Shared Types ───

export interface Firm {
  id: string;
  name: string;
  domain: string;
  plan: 'starter' | 'professional' | 'enterprise';
  logo?: string;
  createdAt: string;
  settings: FirmSettings;
}

export interface FirmSettings {
  defaultLanguage: string;
  timezone: string;
  features: {
    documentAnalysis: boolean;
    research: boolean;
    drafting: boolean;
    knowledgeBase: boolean;
    meetings: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'partner' | 'associate' | 'paralegal' | 'viewer';
  firmId: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Matter {
  id: string;
  name: string;
  clientName: string;
  description: string;
  status: 'active' | 'pending' | 'closed' | 'archived';
  practiceArea: string;
  responsibleUserId: string;
  responsibleUserName: string;
  firmId: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  status: 'uploaded' | 'processing' | 'ready' | 'failed';
  matterId: string;
  matterName: string;
  uploadedBy: string;
  uploaderName: string;
  firmId: string;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  index: number;
  text: string;
  pageNumber: number;
  metadata: Record<string, unknown>;
}

export interface RiskLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  label: string;
  color: string;
}

export interface ClauseCard {
  id: string;
  type: string;
  excerpt: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  rationale: string;
  suggestedEdit: string;
  position: { start: number; end: number };
}

export interface RiskReport {
  documentId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  clauses: ClauseCard[];
  metadata: Record<string, unknown>;
}

export interface Analysis {
  id: string;
  documentId: string;
  documentName: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  clauses: ClauseCard[];
  createdAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface ResearchBrief {
  id: string;
  title: string;
  query: string;
  status: 'pending' | 'researching' | 'completed' | 'failed';
  matterId: string;
  matterName: string;
  sources: string[];
  findings: string;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSource {
  id: string;
  title: string;
  url: string;
  snippet: string;
  relevance: number;
}

export interface Draft {
  id: string;
  title: string;
  type: 'email' | 'memo' | 'report' | 'brief' | 'letter';
  status: 'draft' | 'generating' | 'finalized';
  content: string;
  instructions: string;
  matterId: string;
  matterName: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  status: 'scheduled' | 'processing' | 'completed';
  actionItemsCount: number;
  decisionsCount: number;
  matterId?: string;
  matterName?: string;
  transcript?: string;
  summary?: string;
  createdAt: string;
}

export interface MeetingActionItem {
  id: string;
  meetingId: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  createdAt: string;
}

export interface MeetingDecision {
  id: string;
  meetingId: string;
  description: string;
  rationale: string;
  decidedBy: string;
  createdAt: string;
}

export interface KbQuery {
  id: string;
  question: string;
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: KbSource[];
  createdAt: string;
}

export interface KbSource {
  id: string;
  title: string;
  documentId: string;
  excerpt: string;
  pageNumber: number;
}

export interface KbAnswer {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  sources: KbSource[];
  metadata: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  firmId: string;
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  firmId: string;
  rules: PlaybookRule[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookRule {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  clauseType: string;
  criteria: string;
  recommendedAction: string;
  examples: string[];
  enabled: boolean;
}

export interface Job {
  id: string;
  type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  resourceId: string;
  resourceType: string;
  progress: number;
  error?: string;
  result?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  firm: Firm;
}

export interface CreateDocumentRequest {
  name?: string;
  matterId: string;
  file?: File;
}

export interface CreateMatterRequest {
  name: string;
  clientName: string;
  description: string;
  practiceArea: string;
  responsibleUserId: string;
}

export interface CreateDraftRequest {
  title: string;
  type: Draft['type'];
  instructions: string;
  matterId: string;
}

export interface CreateResearchRequest {
  title: string;
  query: string;
  matterId: string;
  sources: string[];
}

export interface KbQueryRequest {
  question: string;
  filters?: {
    dateRange?: { start: string; end: string };
    documentTypes?: string[];
  };
}
