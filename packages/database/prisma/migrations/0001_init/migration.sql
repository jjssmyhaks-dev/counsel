-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Enums
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'PARTNER', 'ASSOCIATE', 'ANALYST', 'READONLY');
CREATE TYPE "public"."MatterType" AS ENUM ('LEGAL', 'CONSULTING');
CREATE TYPE "public"."MatterStatus" AS ENUM ('ACTIVE', 'CLOSED');
CREATE TYPE "public"."DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "public"."AnalysisType" AS ENUM ('CONTRACT_RISK', 'COMPARISON', 'REDLINE');
CREATE TYPE "public"."AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "public"."BriefStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "public"."DraftType" AS ENUM ('EMAIL', 'MEMO', 'REPORT');
CREATE TYPE "public"."DraftStatus" AS ENUM ('DRAFT', 'REVIEWING', 'FINALIZED');
CREATE TYPE "public"."MeetingSource" AS ENUM ('ZOOM', 'TEAMS', 'MEET', 'UPLOAD');
CREATE TYPE "public"."MeetingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED');
CREATE TYPE "public"."ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');
CREATE TYPE "public"."JobType" AS ENUM ('DOCUMENT_PARSE', 'ANALYSIS_RUN', 'BRIEF_GENERATE', 'MEETING_PROCESS', 'DRAFT_GENERATE', 'CHUNK_EMBED');
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- Firms
CREATE TABLE "public"."firms" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "seat_count" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "firms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "firms_slug_key" ON "public"."firms"("slug");

-- Users
CREATE TABLE "public"."users" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'READONLY',
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
CREATE INDEX "users_firm_id_idx" ON "public"."users"("firm_id");
ALTER TABLE "public"."users" ADD CONSTRAINT "users_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sessions
CREATE TABLE "public"."sessions" (
    "id" UUID NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_session_token_key" ON "public"."sessions"("session_token");
CREATE INDEX "sessions_user_id_idx" ON "public"."sessions"("user_id");
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accounts
CREATE TABLE "public"."accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "public"."accounts"("provider", "provider_account_id");
CREATE INDEX "accounts_user_id_idx" ON "public"."accounts"("user_id");
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Matters
CREATE TABLE "public"."matters" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."MatterType" NOT NULL DEFAULT 'LEGAL',
    "status" "public"."MatterStatus" NOT NULL DEFAULT 'ACTIVE',
    "client_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    CONSTRAINT "matters_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "matters_firm_id_idx" ON "public"."matters"("firm_id");
CREATE INDEX "matters_status_idx" ON "public"."matters"("status");
ALTER TABLE "public"."matters" ADD CONSTRAINT "matters_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."matters" ADD CONSTRAINT "matters_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Documents
CREATE TABLE "public"."documents" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "matter_id" UUID,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "r2_key" TEXT NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documents_firm_id_idx" ON "public"."documents"("firm_id");
CREATE INDEX "documents_matter_id_idx" ON "public"."documents"("matter_id");
CREATE INDEX "documents_status_idx" ON "public"."documents"("status");
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Document Chunks
CREATE TABLE "public"."document_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "section_title" TEXT,
    "page_number" INTEGER,
    "embedding" vector(1536),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "document_chunks_document_id_idx" ON "public"."document_chunks"("document_id");
CREATE INDEX "document_chunks_firm_id_idx" ON "public"."document_chunks"("firm_id");
ALTER TABLE "public"."document_chunks" ADD CONSTRAINT "document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."document_chunks" ADD CONSTRAINT "document_chunks_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Analyses
CREATE TABLE "public"."analyses" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "type" "public"."AnalysisType" NOT NULL,
    "status" "public"."AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "model_used" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "analyses_document_id_idx" ON "public"."analyses"("document_id");
CREATE INDEX "analyses_firm_id_idx" ON "public"."analyses"("firm_id");
CREATE INDEX "analyses_status_idx" ON "public"."analyses"("status");
ALTER TABLE "public"."analyses" ADD CONSTRAINT "analyses_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."analyses" ADD CONSTRAINT "analyses_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Research Briefs
CREATE TABLE "public"."research_briefs" (
    "id" UUID NOT NULL,
    "matter_id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "status" "public"."BriefStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "model_used" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    CONSTRAINT "research_briefs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "research_briefs_matter_id_idx" ON "public"."research_briefs"("matter_id");
CREATE INDEX "research_briefs_firm_id_idx" ON "public"."research_briefs"("firm_id");
CREATE INDEX "research_briefs_status_idx" ON "public"."research_briefs"("status");
ALTER TABLE "public"."research_briefs" ADD CONSTRAINT "research_briefs_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."research_briefs" ADD CONSTRAINT "research_briefs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."research_briefs" ADD CONSTRAINT "research_briefs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drafts
CREATE TABLE "public"."drafts" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "matter_id" UUID,
    "type" "public"."DraftType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "status" "public"."DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "instructions" TEXT,
    "model_used" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "drafts_firm_id_idx" ON "public"."drafts"("firm_id");
CREATE INDEX "drafts_matter_id_idx" ON "public"."drafts"("matter_id");
CREATE INDEX "drafts_status_idx" ON "public"."drafts"("status");
ALTER TABLE "public"."drafts" ADD CONSTRAINT "drafts_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."drafts" ADD CONSTRAINT "drafts_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."drafts" ADD CONSTRAINT "drafts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Meetings
CREATE TABLE "public"."meetings" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "matter_id" UUID,
    "title" TEXT NOT NULL,
    "transcript" TEXT,
    "meeting_date" TIMESTAMP(3) NOT NULL,
    "source" "public"."MeetingSource" NOT NULL DEFAULT 'UPLOAD',
    "status" "public"."MeetingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "meetings_firm_id_idx" ON "public"."meetings"("firm_id");
CREATE INDEX "meetings_matter_id_idx" ON "public"."meetings"("matter_id");
CREATE INDEX "meetings_status_idx" ON "public"."meetings"("status");
ALTER TABLE "public"."meetings" ADD CONSTRAINT "meetings_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."meetings" ADD CONSTRAINT "meetings_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Meeting Action Items
CREATE TABLE "public"."meeting_action_items" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "owner_id" UUID,
    "due_date" TIMESTAMP(3),
    "status" "public"."ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_action_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "meeting_action_items_meeting_id_idx" ON "public"."meeting_action_items"("meeting_id");
CREATE INDEX "meeting_action_items_owner_id_idx" ON "public"."meeting_action_items"("owner_id");
ALTER TABLE "public"."meeting_action_items" ADD CONSTRAINT "meeting_action_items_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."meeting_action_items" ADD CONSTRAINT "meeting_action_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Meeting Decisions
CREATE TABLE "public"."meeting_decisions" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_decisions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "meeting_decisions_meeting_id_idx" ON "public"."meeting_decisions"("meeting_id");
ALTER TABLE "public"."meeting_decisions" ADD CONSTRAINT "meeting_decisions_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- KB Queries
CREATE TABLE "public"."kb_queries" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "matter_id" UUID,
    "answer" TEXT,
    "source_chunks" JSONB,
    "confidence" DOUBLE PRECISION,
    "model_used" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" UUID NOT NULL,
    CONSTRAINT "kb_queries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "kb_queries_firm_id_idx" ON "public"."kb_queries"("firm_id");
CREATE INDEX "kb_queries_matter_id_idx" ON "public"."kb_queries"("matter_id");
ALTER TABLE "public"."kb_queries" ADD CONSTRAINT "kb_queries_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."kb_queries" ADD CONSTRAINT "kb_queries_matter_id_fkey" FOREIGN KEY ("matter_id") REFERENCES "public"."matters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."kb_queries" ADD CONSTRAINT "kb_queries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Audit Logs
CREATE TABLE "public"."audit_logs" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "details" JSONB,
    "model_used" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_firm_id_idx" ON "public"."audit_logs"("firm_id");
CREATE INDEX "audit_logs_user_id_idx" ON "public"."audit_logs"("user_id");
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "public"."audit_logs"("resource_type", "resource_id");
CREATE INDEX "audit_logs_created_at_idx" ON "public"."audit_logs"("created_at");
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Playbooks
CREATE TABLE "public"."playbooks" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "playbooks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "playbooks_firm_id_idx" ON "public"."playbooks"("firm_id");
ALTER TABLE "public"."playbooks" ADD CONSTRAINT "playbooks_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Jobs
CREATE TABLE "public"."jobs" (
    "id" UUID NOT NULL,
    "firm_id" UUID NOT NULL,
    "type" "public"."JobType" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "jobs_firm_id_idx" ON "public"."jobs"("firm_id");
CREATE INDEX "jobs_status_idx" ON "public"."jobs"("status");
CREATE INDEX "jobs_type_idx" ON "public"."jobs"("type");
ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_firm_id_fkey" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
