/**
 * AI Service Client — HTTP client for the Python FastAPI AI service.
 * 
 * This is the bridge between the Express API and the Python AI service.
 * The Python service handles: parsing, chunking, embedding, RAG, contract analysis,
 * research synthesis, drafting, and meeting processing.
 */

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export interface AiClientOptions {
  timeout?: number;
  retries?: number;
}

interface ClauseFinding {
  clause_type: string;
  text_excerpt: string;
  page_ref?: number;
  risk_level: 'low' | 'medium' | 'high';
  rationale: string;
  suggested_edit?: string;
}

interface ContractAnalysisResponse {
  document_id: string;
  clauses: ClauseFinding[];
  summary: string;
}

interface Finding {
  statement: string;
  citations: Array<{
    document_id: string;
    chunk_id: string;
    section_title?: string;
    excerpt: string;
  }>;
  confidence: number;
}

interface ResearchSynthesisResponse {
  brief_id: string;
  title: string;
  findings: Finding[];
  open_questions: string[];
}

interface DraftResponse {
  draft_id: string;
  content: string;
  model_used: string;
  draft_type: string;
}

interface ActionItem {
  text: string;
  owner_hint?: string;
  due_date_hint?: string;
}

interface MeetingProcessResponse {
  meeting_id: string;
  decisions: string[];
  action_items: ActionItem[];
  open_questions: string[];
}

interface SearchResult {
  chunk_id: string;
  document_id: string;
  text: string;
  section_title?: string;
  page_number?: number;
  similarity: number;
}

interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

interface Chunk {
  index: number;
  text: string;
  section_title?: string;
  page_number?: number;
  metadata: Record<string, unknown>;
}

interface RouteResponse {
  intent: string;
  confidence: number;
  reasoning: string;
  required_agents: string[];
  parameters: Record<string, unknown>;
}

interface ValidateResponse {
  passed: boolean;
  blocked: boolean;
  warnings: string[];
  checks: Array<{ check: string; passed: boolean }>;
}

class AiServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public aiErrorCode?: string,
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

async function aiRequest<T>(
  path: string,
  options: RequestInit = {},
  clientOptions: AiClientOptions = {},
): Promise<T> {
  const { timeout = 5000, retries = 1 } = clientOptions;
  const url = `${AI_SERVICE_URL}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new AiServiceError(
          errBody.detail || errBody.error || `AI service error: ${response.statusText}`,
          response.status,
          errBody.error,
        );
      }

      return response.json();
    } catch (error) {
      lastError = error as Error;
      if (error instanceof AiServiceError) throw error;
      // Connection refused / unreachable — don't retry, fail fast
      if (lastError.message?.includes('fetch failed') || lastError.message?.includes('ECONNREFUSED')) {
        break;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw new AiServiceError(
    `AI service unavailable at ${AI_SERVICE_URL}: ${lastError?.message || 'unknown error'}`,
  );
}

export const aiClient = {
  // Health
  health: () =>
    aiRequest<{ status: string; embedding_model: string; embedding_dim: number; llm_provider: string }>('/health'),

  // Document Processing
  parseDocument: (documentId: string, mimeType: string, content?: Uint8Array) =>
    aiRequest<{ document_id: string; chunks: Chunk[]; total_pages: number }>('/parse', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, mime_type: mimeType, content: content ? Array.from(content) : undefined }),
    }),

  embedTexts: (texts: string[]) =>
    aiRequest<{ embeddings: number[][] }>('/embed', {
      method: 'POST',
      body: JSON.stringify({ texts }),
    }),

  indexDocument: (documentId: string, firmId: string, chunks: Chunk[], embeddings: number[][], matterId?: string) =>
    aiRequest<{ document_id: string; indexed_count: number; status: string }>('/index', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, firm_id: firmId, chunks, embeddings, matter_id: matterId }),
    }),

  search: (query: string, firmId: string, matterId?: string, topK = 5) =>
    aiRequest<SearchResponse>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, firm_id: firmId, matter_id: matterId, top_k: topK }),
    }),

  // M1: Contract Analysis
  analyzeContract: (documentId: string, chunks: Chunk[], playbookId?: string) =>
    aiRequest<ContractAnalysisResponse>('/analyze/contract', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, chunks, playbook_id: playbookId }),
    }),

  // M2: Research Synthesis
  synthesizeResearch: (matterId: string, query: string, sourceDocumentIds: string[]) =>
    aiRequest<ResearchSynthesisResponse>('/synthesize/research', {
      method: 'POST',
      body: JSON.stringify({ matter_id: matterId, query, source_document_ids: sourceDocumentIds }),
    }),

  // M3: Drafting
  generateDraft: (type: string, instructions: string, matterId?: string, toneExamples?: string[]) =>
    aiRequest<DraftResponse>('/draft', {
      method: 'POST',
      body: JSON.stringify({ type, instructions, matter_id: matterId, tone_examples: toneExamples }),
    }),

  // M4: Meetings
  processMeeting: (meetingId: string, transcript: string) =>
    aiRequest<MeetingProcessResponse>('/process/meeting', {
      method: 'POST',
      body: JSON.stringify({ meeting_id: meetingId, transcript }),
    }),

  // Full pipeline
  processDocument: (documentId: string, mimeType: string) =>
    aiRequest<{ document_id: string; chunks: number; embeddings: number; status: string }>('/process/document', {
      method: 'POST',
      body: JSON.stringify({ document_id: documentId, mime_type: mimeType }),
    }),

  // Orchestrator
  routePrompt: (prompt: string, context?: Record<string, unknown>) =>
    aiRequest<RouteResponse>('/orchestrator/route', {
      method: 'POST',
      body: JSON.stringify({ prompt, context }),
    }),

  validateOutput: (output: string, context?: Record<string, unknown>) =>
    aiRequest<ValidateResponse>('/orchestrator/validate', {
      method: 'POST',
      body: JSON.stringify({ output, context }),
    }),

  // Audit
  queryAuditLog: (params: {
    user_id?: string; firm_id?: string; action?: string; limit?: number; offset?: number;
  }) =>
    aiRequest<{ entries: unknown[]; total: number; stats: Record<string, unknown> }>('/orchestrator/audit/query', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};

export { AiServiceError };
export type {
  ClauseFinding, ContractAnalysisResponse, Finding, ResearchSynthesisResponse,
  DraftResponse, ActionItem, MeetingProcessResponse, SearchResult, SearchResponse,
  Chunk, RouteResponse, ValidateResponse,
};
