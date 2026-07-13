# Counsel SOC 2 Type II Readiness Assessment

## Trust Service Criteria Mapping

### Security (CC1-CC6)
| Control | Counsel Implementation |
|---------|----------------------|
| CC1.1 — Logical access controls | JWT auth + WorkOS SSO (SAML/OIDC) + role-based access (ADMIN/PARTNER/ASSOCIATE/ANALYST/READONLY) |
| CC1.2 — Physical access | N/A (cloud-hosted on Cloudflare) — covered by Cloudflare's SOC 2 |
| CC2.1 — System operations | Pipeline Orchestrator manages async jobs with retry logic. Audit trail logs all AI operations. |
| CC2.2 — Change management | Git-based version control. CI/CD pipeline deploys from `main` branch. |
| CC2.3 — Risk mitigation | QualityGateAgent validates all AI outputs. Rate limiting prevents abuse. |
| CC3.1 — Logical security | Helmet.js security headers (CSP, HSTS, XSS filter). TLS 1.3 enforced. |
| CC3.2 — Environmental controls | N/A (cloud) |
| CC4.1 — Monitoring | AuditTrailAgent provides immutable operation log. Express error handler captures all exceptions. |
| CC5.1 — Control monitoring | `requireRole()` middleware enforces access control. `withTenantContext()` enforces RLS. |
| CC6.1 — Vendor management | Cloudflare R2/AI providers documented. External LLM providers (OpenAI/Anthropic) abstracted behind provider interface. |

### Availability (A1)
| Control | Counsel Implementation |
|---------|----------------------|
| A1.1 — Availability monitoring | Load testing with Artillery (ramp to 20 concurrent users). P99 latency target < 3s. |
| A1.2 — Recovery | Postgres connection pooling with auto-reconnect. Async job queue (BullMQ/Redis) for AI processing. |
| A1.3 — Capacity management | Horizontal scaling: stateless Express API + stateless Python AI service. |

### Processing Integrity (PI1)
| Control | Counsel Implementation |
|---------|----------------------|
| PI1.1 — Data processing completeness | Two-pass contract analysis ensures extract + evaluate. Pipeline Orchestrator tracks step completion. |
| PI1.2 — Accuracy | QualityGateAgent confidence threshold (0.7) gates KB responses. Low-confidence queries return "no match" instead of guessing. |
| PI1.3 — Processing controls | AuditTrailAgent logs model used, sources retrieved, output hashes for every AI operation. |

### Confidentiality (C1)
| Control | Counsel Implementation |
|---------|----------------------|
| C1.1 — Confidential information identification | Firm-playbook rules identify sensitive clause types. |
| C1.2 — Data disposal | `DELETE /api/v1/documents/:id` cascades to remove chunks + embeddings. |
| C1.3 — Encryption | Envelope encryption with per-firm data keys. TLS 1.3 in transit. |

### Privacy (P1-P8)
| Control | Counsel Implementation |
|---------|----------------------|
| P1.1 — Notice | Privacy policy to be documented in-app. |
| P3.1 — Consent | User consent captured during SSO onboarding flow. |
| P4.1 — Data minimization | Only document metadata + embeddings stored. Raw content retained per firm retention policy. |
| P6.1 — Access | Users can export their data via API. Admins can view audit logs of all operations on their firm's data. |
| P8.1 — Data quality | Audit trails enable correction verification. |

## Vendor Risk Assessment

| Vendor | Service | SOC 2 Status | Data Handled |
|--------|---------|-------------|--------------|
| Cloudflare | Workers AI, R2, DNS | SOC 2 Type II | Document content (encrypted at rest), AI prompts/responses |
| PostgreSQL | Primary database | Self-managed | User data, firm data, embeddings, audit logs |
| Redis | Job queue | Self-managed | Transient job state only |
| WorkOS | SSO authentication | SOC 2 Type II | User identity, email, organization membership |

## Evidence Collection Plan

Collect the following for the auditor:
1. **System description:** This document + README.md
2. **Access control evidence:** Screenshots of admin panel showing role assignments. Export of user table with role distribution.
3. **Audit log samples:** Export of AuditTrailAgent entries showing all CRUD + AI operations with timestamps.
4. **Encryption evidence:** Code review of `withTenantContext()` and envelope encryption implementation.
5. **Load test results:** Artillery report showing latency and error rate under sustained load.
6. **Change management evidence:** Git commit history with PR descriptions.
7. **Vulnerability scans:** `npm audit` and `pip-audit` output.
8. **Penetration test results:** Execution of the penetration test plan (section 7 of encryption-review.md).

## Timeline to SOC 2 Type II

| Phase | Duration | Activities |
|-------|----------|-----------|
| Pilot hardening | 2-4 weeks | Load testing, security audit, dependency patching |
| Pilot operation | 4-6 weeks | First firm onboarded, monitoring established, evidence collection |
| Pre-assessment | 2 weeks | Internal readiness review, gap remediation |
| SOC 2 Type II audit | 3-6 months | External auditor engagement, evidence submission, report issuance |

**Estimated total: 6-9 months from pilot start to SOC 2 Type II report.**
