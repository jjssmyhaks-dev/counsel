# Counsel Pilot Launch Checklist

## Pre-Launch (Week -2)
- [ ] Deploy production PostgreSQL instance with pgvector extension
- [ ] Create production database and run migrations
- [ ] Configure Cloudflare Workers AI API token in production env
- [ ] Configure WorkOS production client ID and API key
- [ ] Run full load test suite (Artillery) — must pass at 20 concurrent users with <5% error rate
- [ ] Complete security audit (see scripts/security-audit/)
- [ ] Enable TLS 1.3 on all endpoints
- [ ] Configure Helmet.js security headers on Express API
- [ ] Enable rate limiting on all public endpoints
- [ ] Set up monitoring (Uptime, error logging, API latency alerts)
- [ ] Configure automated database backups (daily, encrypted)
- [ ] Pilot firm NDA and agreement signed
- [ ] Create pilot firm tenant in production database
- [ ] Configure SSO connection in WorkOS for pilot firm's IdP

## Launch Week (Week 0)

### Day 0
- [ ] Admin user onboarding (create accounts via CLI: `npx tsx scripts/onboarding/cli.ts onboard`)
- [ ] Set admin user roles (ADMIN)
- [ ] Invite remaining firm users (PARTNER, ASSOCIATE, ANALYST)
- [ ] Configure firm playbook with 8 standard clause rules
- [ ] Batch-ingest pilot firm's existing contracts/documents
- [ ] Verify documents are searchable in KB

### Day 1
- [ ] 60-minute full team training session
- [ ] Demo: Upload a contract → run analysis → review risk report
- [ ] Demo: Ask the Firm — query the knowledge base
- [ ] Demo: Draft an email/memo in firm voice
- [ ] Demo: Meeting transcript → action items extraction
- [ ] Assign "power users" as internal champions

### Day 2
- [ ] Check-in call with pilot firm — collect first feedback
- [ ] Review error logs and audit trail for anomalies
- [ ] Tune playbook rules based on early feedback

### Days 2-5
- [ ] Daily monitoring of usage metrics
- [ ] Address any blockers within 4 hours (SLA for pilot)
- [ ] Log all feature requests and bugs

## Success Metrics Tracking (Week 1-4)

### KPIs (from PRD)
- [ ] Firm's first AI-assisted contract review completed within 1 day of onboarding
- [ ] Weekly active users / total seats (target: ≥60% by week 4)
- [ ] Median contract review time: baseline measured, target ≥30% reduction
- [ ] "Ask the Firm" queries per active user per week (target: ≥3)
- [ ] Drafts generated vs finalized ratio (target: >50% finalized)
- [ ] Meeting transcripts processed per week
- [ ] User satisfaction survey: NPS ≥40 after week 2

### Weekly Checkpoints
- [ ] Week 1: All users logged in, first contract analyzed, first KB query
- [ ] Week 2: User satisfaction survey sent, NPS measured
- [ ] Week 3: Usage patterns analyzed, power users identified
- [ ] Week 4: Pilot retrospective preparation

## Post-Pilot (Week 5+)
- [ ] Pilot retrospective meeting with firm stakeholders
- [ ] Product roadmap prioritization based on pilot feedback
- [ ] Bug fixes from pilot feedlogged and prioritized
- [ ] Scale plan: identify next 3-5 firms for expansion
- [ ] Initiate SOC 2 Type II audit process
- [ ] Draft marketing case study from pilot results
- [ ] Pricing model refinement based on usage data

## Rollback Plan
If the pilot is unsuccessful:
1. Export all pilot firm data (documents, analyses, drafts)
2. Provide data in standard formats (PDF originals, JSON exports)
3. Deactivate firm tenant (soft-delete)
4. Retain encrypted backups for 30 days per agreement
5. Conduct post-mortem: what went wrong, what to improve
