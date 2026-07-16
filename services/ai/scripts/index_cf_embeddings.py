"""Index sample legal docs into pgvector using Cloudflare Workers AI embeddings (768-dim).

Usage: cd services/ai && python scripts/index_cf_embeddings.py
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx

# Load .env manually to avoid complex module dependencies
env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

CF_ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
CF_TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
EMBED_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/@cf/baai/bge-base-en-v1.5"
DB_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:***@localhost:5432/counsel")

FIRM_ID = "ce7b93db-dc73-4407-a91c-450c128fa26f"

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ──────── Sample Documents ────────
SAMPLE_DOCS = [
    {
        "title": "Mutual Non-Disclosure Agreement",
        "text": """
SECTION 1: DEFINITIONS. "Confidential Information" means any information disclosed by either party, designated as confidential. Includes trade secrets, business plans, customer lists, financial data, technical specifications, and source code.

SECTION 2: OBLIGATIONS. Receiving Party shall hold all Confidential Information in strict confidence, not disclose to third parties without prior written consent, use solely for evaluating the business relationship, and protect with at least reasonable care.

SECTION 3: EXCLUSIONS. Does not include information that is publicly available, was known to Receiving Party prior to disclosure, is independently developed, or is rightfully obtained from a third party.

SECTION 4: TERM AND RETURN. This Agreement remains in effect for three years. Upon termination, Receiving Party shall return or destroy all Confidential Information and certify in writing.

SECTION 5: REMEDIES. Any breach may cause irreparable harm. Disclosing Party is entitled to seek injunctive relief, specific performance, or other equitable remedies.

SECTION 6: GOVERNING LAW. Governed by the laws of the State of Delaware.

SECTION 7: INDEMNIFICATION. Each party indemnifies the other from losses, damages, liabilities, costs, and expenses (including attorneys' fees) arising from any breach by the indemnifying party.
""",
    },
    {
        "title": "SaaS Master Service Agreement",
        "text": """
ARTICLE 1: SCOPE. Provider shall furnish cloud-based legal document management platform with 99.9% uptime.

ARTICLE 2: FEES. Monthly subscription fees due net 30 days. Late payments accrue interest at 1.5% per month.

ARTICLE 3: DATA PROTECTION. AES-256 encryption at rest, TLS 1.3 in transit, SOC 2 Type II certified, annual penetration testing. Breach notification within 72 hours.

ARTICLE 4: INTELLECTUAL PROPERTY. Provider retains all rights in the Service. Customer retains all rights in Customer Data.

ARTICLE 5: LIMITATION OF LIABILITY. Total aggregate liability not to exceed fees paid in preceding 12 months. No liability for indirect, incidental, special, consequential, or exemplary damages.

ARTICLE 6: TERMINATION. Either party may terminate for convenience on 90 days notice. Upon termination, Provider shall make Customer Data available for export within 30 days.

ARTICLE 7: CONFIDENTIALITY. Each party shall maintain confidentiality of non-public information with at least reasonable care.

ARTICLE 8: GOVERNING LAW. Governed by Delaware law. Disputes resolved through AAA arbitration in Wilmington, Delaware.
""",
    },
    {
        "title": "Executive Employment Agreement",
        "text": """
1. POSITION. Employee serves as Vice President of Engineering, reports to CEO, leads 50-75 engineers, develops technical roadmap, ensures product delivery.

2. COMPENSATION. Base Salary $285,000. Annual Performance Bonus 35%. Equity Grant 0.25% with four-year vesting and one-year cliff.

3. BENEFITS. Health insurance, 401(k) with 4% match, life insurance 2x salary, 20 days PTO, $5,000 professional development stipend.

4. NON-COMPETE. For 12 months following termination, Employee shall not engage in competing business. Does not apply to passive ownership under 1% of public companies.

5. NON-SOLICITATION. For 12 months, Employee shall not solicit or hire Company employees nor solicit Company customers.

6. CONFIDENTIALITY AND INVENTION ASSIGNMENT. Employee shall maintain confidentiality and assign all inventions to the Company.

7. TERMINATION. At-will with 30 days notice. Severance: 6 months base salary plus accelerated vesting of 50% unvested equity.

8. CHANGE OF CONTROL. 100% acceleration of unvested equity plus 12 months retention payment.

9. GOVERNING LAW. California law. Arbitration in San Francisco.
""",
    },
    {
        "title": "Intellectual Property License Agreement",
        "text": """
GRANT OF LICENSE. Licensor grants Licensee non-exclusive, worldwide, royalty-bearing license under Licensed Patents and Licensed Technology to develop, manufacture, sell, and import Licensed Products. Includes sublicense rights.

DEFINITIONS. Licensed Patents means all patents and applications in Schedule A. Licensed Technology means all technical information, know-how, and trade secrets in Schedule B. Licensed Territory means worldwide.

ROYALTIES. Running royalty of 3.5% of Net Sales. Minimum Annual Royalty $250,000 per calendar year. Due quarterly within 45 days.

REPRESENTATIONS. Licensor warrants it has full right and title in Licensed Patents, authority to grant licenses, patents are valid and enforceable, and technology does not infringe third-party IP.

INDEMNIFICATION. Licensor shall indemnify Licensee from claims alleging Licensed Products infringe third-party patents, copyrights, or trade secrets.

TERM. Continues until expiration of last-to-expire Licensed Patent or 10 years from Effective Date. 180 days notice for material breach.

DISPUTE RESOLUTION. JAMS mediation in New York, then binding arbitration with three arbitrators. Losing party pays all costs.

GOVERNING LAW. New York law without regard to conflict of laws principles.
""",
    },
]


def chunk_document(text: str, chunk_size: int = 600, overlap: int = 150) -> list[dict]:
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks = []
    current_text = ""
    chunk_index = 0

    for para in paragraphs:
        if len(current_text) + len(para) + 2 > chunk_size and current_text:
            chunks.append({"text": current_text.strip(), "index": chunk_index})
            chunk_index += 1
            words = current_text.split()
            ow = words[-overlap // 4:] if len(words) > overlap // 4 else words
            current_text = " ".join(ow) + " " + para
        else:
            current_text += " " + para

    if current_text.strip():
        chunks.append({"text": current_text.strip(), "index": chunk_index})

    return chunks


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate embeddings via Cloudflare Workers AI (768-dim)."""
    results = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for text in texts:
            payload = {"text": [text]}
            headers = {"Authorization": f"Bearer {CF_TOKEN}", "Content-Type": "application/json"}
            resp = await client.post(EMBED_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            # Cloudflare returns {"result": {"shape": [1, 768], "data": [[...]]}}
            emb = data["result"]["data"][0]
            results.append(emb)
    return results


async def main():
    import asyncpg
    pool = await asyncpg.create_pool(DB_URL, min_size=1, max_size=5)

    async with pool.acquire() as conn:
        # Find firm UUID
        firm = await conn.fetchrow("SELECT id, name FROM firms LIMIT 1")
        if not firm:
            logger.error("No firm found!")
            return
        firm_id = str(firm["id"])
        logger.info("Firm: %s (%s)", firm["name"], firm_id)

        # Drop and recreate with vector(768)
        logger.info("Dropping old document_chunks...")
        await conn.execute("DROP TABLE IF EXISTS document_chunks CASCADE")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute("""
            CREATE TABLE document_chunks (
                id            TEXT PRIMARY KEY,
                document_id   TEXT NOT NULL,
                firm_id       TEXT NOT NULL,
                chunk_index   INTEGER NOT NULL,
                text          TEXT NOT NULL,
                section_title TEXT,
                page_number   INTEGER,
                embedding     vector(768),
                metadata      JSONB DEFAULT '{}'::jsonb,
                created_at    TIMESTAMPTZ DEFAULT NOW(),
                updated_at    TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        logger.info("Table created with vector(768)")

    # Index documents
    total = 0
    for i, doc in enumerate(SAMPLE_DOCS):
        doc_id = f"sample-cf-{i+1:02d}"
        logger.info("[%d/%d] %s", i+1, len(SAMPLE_DOCS), doc["title"])

        chunks = chunk_document(doc["text"])
        logger.info("  → %d chunks", len(chunks))

        texts = [c["text"] for c in chunks]
        try:
            embeddings = await embed_texts(texts)
            logger.info("  → %d embeddings (dim=%d)", len(embeddings), len(embeddings[0]))
        except Exception as e:
            logger.error("  → Embedding failed: %s", e)
            continue

        async with pool.acquire() as conn:
            async with conn.transaction():
                for ci, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                    chunk_id = f"{doc_id}-chunk-{ci}"
                    vector_str = "[" + ",".join(str(v) for v in emb) + "]"
                    await conn.execute(
                        """INSERT INTO document_chunks (id, document_id, firm_id, chunk_index, text, embedding)
                           VALUES ($1, $2, $3, $4, $5, $6::vector)
                           ON CONFLICT (id) DO NOTHING""",
                        chunk_id, doc_id, firm_id, ci, chunk["text"], vector_str,
                    )
                    total += 1

        logger.info("  → stored %d chunks", len(chunks))

    logger.info("=== Total: %d chunks indexed ===", total)

    # Verify: Cloudflare-embed a query and search
    test_query = "limitation of liability and indemnification in SaaS contracts"
    test_emb = await embed_texts([test_query])
    vector_str = "[" + ",".join(str(v) for v in test_emb[0]) + "]"

    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT id, text, 1 - (embedding <=> $1::vector) AS similarity
            FROM document_chunks WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1 LIMIT 3
        """, vector_str)

    logger.info("Verification: '%s' → %d results", test_query, len(rows))
    for r in rows:
        logger.info("  → [%s] sim=%.4f: %s...", r["id"], r["similarity"], r["text"][:80])

    await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
