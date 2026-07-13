# Counsel Pilot Metrics Dashboard

## Dashboard Location
`/admin/metrics` — accessible to ADMIN and PARTNER roles.

## Core KPIs (from PRD §2.6)

| Metric | Target | Data Source | Query |
|--------|--------|-------------|-------|
| Time-to-first-value | ≤ 1 day | AuditLog | First `DOCUMENT_ANALYZED` after user.createdAt |
| Weekly Active Users | ≥ 60% of seats by week 4 | AuditLog | Distinct userId per week / firm.seatCount |
| Contract review time reduction | ≥ 30% | Analysis | Analysis.completedAt - Analysis.createdAt |
| KB queries per active user | ≥ 3/week | KbQuery | Count per userId per week |
| Draft finalization rate | ≥ 50% | Draft | Finalized / Total created |

## Implementation Notes
- Page: `apps/web/src/app/(dashboard)/admin/metrics/page.tsx`
- Built as a 'use client' React component
- Data sourced from AuditLog, Analysis, KbQuery, Draft, and Document tables
- Mock data for pre-launch demo (4-week simulated pilot with Sterling & Associates)
