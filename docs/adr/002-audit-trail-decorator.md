# ADR-002: Audit Trail — From Fake Agent to Real Decorator

**Status:** Accepted  
**Date:** 2026-07-25  
**Author:** Counsel AI Agent System Audit

---

## Context

The Counsel platform positioned an "immutable audit trail of every AI action" as its compliance headline for the legal-vertical product. The original implementation had two gaps:

1. Only 1 of 7 crews (`run_document_intelligence`) actually called `audit_trail.log()`. The other 6 crews produced **zero real audit entries** — drafts, research memos, proposals, and consulting outputs were invisible to the audit system.

2. Crew 4 (Compliance) contained an `AuditLogger` CrewAI agent whose sole purpose was to ask an LLM to write prose confirming "this entry meets SOC 2 Type II requirements." This was a **roleplay output**, not a queryable, persisted audit record. It created the illusion of a control that wasn't real.

---

## Decision

1. **Delete the fake `AuditLogger` agent entirely** — remove `create_audit_logger()` from `definitions.py`, remove `ComplianceTasks.audit_log()` from `tasks.py`, and drop the agent from Crew 4's pipeline (now a 2-agent crew: ComplianceChecker → NegotiatorAdvisor).

2. **Wire real audit logging into the `@with_retry` decorator** — every crew function is already decorated with `@with_retry(crew_name)`, so adding `audit_trail.log()` there gives all 7 crews free audit coverage. No per-crew code changes needed.

3. **Log both success and failure** — the decorator now creates audit entries for:
   - Successful completion (with attempt count, duration)
   - Retry exhaustion (all attempts failed)
   - Non-retryable errors (immediate failure)

4. **Crew name → audit action mapping** — each crew name maps to the appropriate `AuditAction` enum member, which flows through to the JSONL persistence layer.

---

## Why the Decorator?

| Approach | Pros | Cons |
|---|---|---|
| Per-crew `audit_trail.log()` call | Explicit, easy to read | **7 copies of the same code**; easy to forget on new crews |
| `@with_retry` decorator | One place, all crews covered; failure logging is automatic | Less obvious where logging happens when reading crew code |
| Middleware at API route level | No changes to crew code | Can't capture internal retry/recovery details; can't know if the crew actually ran |

The decorator won because **retry/failure audit data is already captured in the same code path** — adding audit log calls there means one consistent story per attempt, not separate retry + audit log calls that could desync.

---

## Audit Entry Schema

Every crew run produces one JSONL line in `services/ai/logs/audit-YYYY-MM-DD.jsonl`:

```json
{
  "id": "audit-20260725143000-a1b2c3d4",
  "timestamp": "2026-07-25T14:30:00+00:00",
  "action": "contract_analysis_completed",
  "resource_id": "document_intelligence",
  "user_id": "system",
  "firm_id": null,
  "duration_ms": 3421,
  "success": true,
  "metadata": {"attempt": 1, "retries": 0}
}
```

File rotates at 10 MB. Old logs are preserved with timestamp suffix.

---

## Consequences

### Positive
- All 7 crews now produce real, queryable audit entries
- No code duplication — one decorator handles all crews
- Failure audit is automatic (was missing before)
- Deleted ~50 lines of misleading code (fake Auditor agent + task)

### Negative
- Crew functions now log `user_id: "system"` unless they explicitly pass `firm_id`/`user_id` parameters (future improvement)
- Audit log JSONL files can accumulate quickly in high-traffic deployments (rotation cap is 10 MB per file)

### Risks
- If the JSONL write fails (disk full, permissions), `write_event()` silently swallows the error — audit data loss without alerting
- No deduplication — if a crew is called twice for the same document, both entries exist; dedup is left to the consumer

---

## Future Improvements

- Pass `firm_id`/`user_id` through crew function signatures and into the decorator
- Add structured alerting for JSONL write failures
- Add a `/audit/query` API endpoint for compliance officers
- Implement cryptographic chaining (hash each entry + include previous hash) for tamper evidence
