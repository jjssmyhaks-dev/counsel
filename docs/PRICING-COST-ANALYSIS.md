# Counsel — Indian Market Pricing & Cost Analysis

## Infrastructure Cost per Firm (Monthly)

| Component | Free Tier / Low Usage | Standard Usage | Heavy Usage |
|-----------|----------------------|----------------|-------------|
| Cloudflare Workers AI (LLM) | ₹0 (10K tokens/day free) | ₹2,500 | ₹12,000 |
| Neon PostgreSQL | ₹0 (0.5 GB free) | ₹1,500 | ₹5,000 |
| Cloudflare R2 (storage) | ₹0 (10 GB free) | ₹500 | ₹2,000 |
| Cloudflare CDN + DNS | ₹0 (free tier) | ₹0 | ₹0 |
| Email (Resend) | ₹0 (3K emails free) | ₹500 | ₹2,000 |
| Monitoring (Sentry) | ₹0 (5K events free) | ₹0 | ₹1,500 |
| **Total COGS per firm** | **~₹0** | **~₹5,000** | **~₹22,500** |

## Pricing Plans (INR) — 75% Gross Margin

| Plan | MRP (₹/month) | Annual (₹/month) | COGS | Gross Margin |
|------|---------------|-------------------|------|-------------|
| **Free** | ₹0 | ₹0 | ~₹50 | N/A |
| **Starter** | ₹999 | ₹799 | ~₹1,500 | ~80% |
| **Professional** | ₹4,999 | ₹3,999 | ~₹5,000 | ~75% |
| **Business** | ₹14,999 | ₹11,999 | ~₹12,000 | ~75% |
| **Enterprise** | Custom | Custom | Custom | 75%+ |

### Pricing Logic

**Target**: 75% gross margin minimum across all plans.

**Cost Assumptions**:
- LLM API cost dominates at ~₹0.02 per 1K tokens (Cloudflare Workers AI pricing)
- Average firm: ~50 documents/month, ~200 chat queries, ~50 AI actions
- Professional firm: ~500 documents, ~1000 chat queries, ~200 AI actions
- Heavy firm: ~2000 documents, ~5000 chat queries, ~1000 AI actions

**Revenue per user**:
- Indian CA firms typically have 3-10 users per office
- Solo CAs: 1-2 users (₹999 Starter plan)
- Small firms (2-10 CAs): 5-10 users (₹4,999 Professional)
- Mid firms (10-50 CAs): 25-50 users (₹14,999 Business)
- Large firms (50+ CAs): Enterprise with custom pricing

### Indian Payment Methods
- UPI (PhonePe, Google Pay, Paytm)
- Net Banking
- Credit/Debit Cards
- NEFT/RTGS for annual plans
- GST invoice (18% GST extra on all plans)
