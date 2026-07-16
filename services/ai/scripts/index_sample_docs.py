"""Drop existing document_chunks and recreate with correct schema,
then index 4 sample legal docs using proper UUIDs from the firm table.
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.config import settings
from src.embeddings.embedder import embedder
from src.rag.retriever import retriever
from src.db.client import get_pool, close_pool

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# ────────────────────────── Sample Documents ──────────────────────────

SAMPLE_DOCS = [
    {
        "title": "Mutual Non-Disclosure Agreement — Standard Template",
        "text": """
SECTION 1: DEFINITIONS
"Confidential Information" means any information disclosed by either party to the other party, directly or indirectly, in writing, orally or by inspection of tangible objects, which is designated as "Confidential," "Proprietary" or some similar designation. Confidential Information includes, but is not limited to: (a) trade secrets; (b) business plans and strategies; (c) customer lists and pricing information; (d) financial data and projections; (e) technical specifications and source code.

SECTION 2: OBLIGATIONS OF RECEIVING PARTY
The Receiving Party shall: (a) hold all Confidential Information in strict confidence; (b) not disclose Confidential Information to any third parties without the prior written consent of the Disclosing Party; (c) use Confidential Information solely for the purpose of evaluating the potential business relationship; (d) protect Confidential Information using the same degree of care it uses to protect its own confidential information, but in no event less than reasonable care.

SECTION 3: EXCLUSIONS
Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was known to the Receiving Party prior to disclosure by the Disclosing Party; (c) is independently developed by the Receiving Party without use of the Confidential Information; (d) is rightfully obtained by the Receiving Party from a third party without violation of any confidentiality obligation.

SECTION 4: TERM AND RETURN OF INFORMATION
This Agreement shall remain in effect for a period of three (3) years from the date of execution. Upon termination or expiration, the Receiving Party shall promptly return or destroy all Confidential Information and certify in writing that it has done so.

SECTION 5: REMEDIES
The Receiving Party acknowledges that any breach of this Agreement may cause irreparable harm. The Disclosing Party shall be entitled to seek injunctive relief, specific performance, or other equitable remedies in addition to all other remedies available at law or in equity.

SECTION 6: GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware.

SECTION 7: INDEMNIFICATION
Each party agrees to indemnify, defend, and hold harmless the other party from and against any and all losses, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or resulting from any breach of this Agreement by the indemnifying party.
""",
    },
    {
        "title": "SaaS Master Service Agreement — Enterprise Edition",
        "text": """
ARTICLE 1: SCOPE OF SERVICES
Provider shall furnish to Customer the cloud-based legal document management platform (the "Service") as described in the Order Form, including modules for contract analysis, document drafting, legal research, and compliance monitoring. Provider shall provide the Service with a minimum uptime of 99.9% measured monthly.

ARTICLE 2: SUBSCRIPTION FEES
Customer shall pay monthly subscription fees. Fees are due net thirty (30) days from the invoice date. Late payments shall accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law.

ARTICLE 3: DATA PROTECTION AND SECURITY
Provider shall implement and maintain industry-standard security measures including: AES-256 encryption at rest, TLS 1.3 encryption in transit, SOC 2 Type II certified infrastructure, and annual penetration testing. Provider shall notify Customer of any breach within seventy-two (72) hours of discovery.

ARTICLE 4: INTELLECTUAL PROPERTY
Provider retains all right, title, and interest in the Service and all improvements, modifications, and derivatives thereof. Customer retains all right, title, and interest in Customer Data.

ARTICLE 5: LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROVIDER'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID BY CUSTOMER IN THE TWELVE MONTHS PRECEDING THE EVENT. IN NO EVENT SHALL PROVIDER BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES.

ARTICLE 6: TERMINATION
Either party may terminate for convenience upon ninety (90) days' written notice. Upon termination, Provider shall make Customer Data available for export within thirty (30) days.

ARTICLE 7: CONFIDENTIALITY
Each party agrees to maintain the confidentiality of all non-public information received from the other party.

ARTICLE 8: GOVERNING LAW
This Agreement shall be governed by the laws of the State of Delaware. Disputes shall be resolved through binding arbitration under AAA rules in Wilmington, Delaware.

ARTICLE 9: ENTIRE AGREEMENT
This Agreement, together with all Order Forms and Schedules, constitutes the entire agreement between the parties and supersedes all prior agreements.
""",
    },
    {
        "title": "Executive Employment Agreement — VP of Engineering",
        "text": """
1. POSITION AND DUTIES
Employee shall serve as Vice President of Engineering and report to the CEO. Employee shall lead 50-75 engineers, develop the technical roadmap, ensure product delivery, maintain code quality, recruit talent, and manage the engineering budget.

2. COMPENSATION
Base Salary: $285,000 per year. Annual Performance Bonus: 35% of Base Salary, based on milestones set by the CEO. Initial Equity Grant: 0.25% of fully diluted shares, four-year vesting with one-year cliff.

3. BENEFITS
Employee shall receive: health insurance (medical, dental, vision), 401(k) with 4% company match, life insurance at 2x salary, disability insurance, 20 days PTO plus 10 holidays, and $5,000 annual professional development stipend.

4. NON-COMPETE
For twelve (12) months following termination, Employee shall not engage in any business competing directly with the Company within the geographic areas where the Company conducts business. This shall not apply to passive ownership of less than 1% of any public company.

5. NON-SOLICITATION
For twelve (12) months following termination, Employee shall not: (a) solicit or hire any employee of the Company; (b) solicit any customer or client of the Company that Employee had contact with during the last twelve months.

6. CONFIDENTIALITY AND INVENTION ASSIGNMENT
Employee agrees to maintain confidentiality of all proprietary information and assign all inventions conceived during employment to the Company.

7. TERMINATION
Either party may terminate at-will with thirty (30) days' notice. Upon termination without cause, Employee receives six months severance plus accelerated vesting of 50% unvested equity.

8. CHANGE OF CONTROL
On Change of Control, 100% of unvested equity accelerates immediately plus a lump-sum retention payment equal to twelve months of Base Salary.

9. GOVERNING LAW
Governed by the laws of the State of California. Disputes resolved through binding arbitration in San Francisco, California.
""",
    },
    {
        "title": "Intellectual Property License Agreement — Technology Transfer",
        "text": """
GRANT OF LICENSE
Licensor grants Licensee a non-exclusive, worldwide, royalty-bearing license under the Licensed Patents and Licensed Technology to develop, manufacture, sell, and import Licensed Products. Includes right to grant sublicenses through multiple tiers.

DEFINITIONS
"Licensed Patents" means all patents and applications listed in Schedule A, including continuations, reissues, extensions, and foreign counterparts. "Licensed Technology" means all technical information, know-how, trade secrets, and materials described in Schedule B. "Licensed Territory" means worldwide.

ROYALTIES
Licensee shall pay Licensor a running royalty of 3.5% of Net Sales of Licensed Products. Minimum Annual Royalty: $250,000 per calendar year. Royalties due quarterly within forty-five (45) days of each quarter end.

REPRESENTATIONS AND WARRANTIES
Licensor warrants that: (a) it has full right, title, and interest in the Licensed Patents and Technology; (b) it has authority to grant the licenses herein; (c) the Licensed Patents are valid and enforceable; (d) the Licensed Technology does not infringe any third-party IP rights.

INDEMNIFICATION
Licensor shall indemnify Licensee from any claims arising from allegation that Licensed Products infringe third-party patents, copyrights, or trade secrets.

TERM AND TERMINATION
This Agreement continues until expiration of the last-to-expire Licensed Patent or ten (10) years from Effective Date. Either party may terminate for material breach upon one hundred eighty (180) days' notice.

DISPUTE RESOLUTION
Disputes shall first be submitted to JAMS mediation in New York. If mediation fails, binding arbitration by JAMS with three arbitrators. Losing party pays all costs and attorneys' fees.

GOVERNING LAW
Governed by the laws of the State of New York, without regard to conflict of laws principles.
""",
    },
]


# ────────────────────────── Helpers ──────────────────────────

def chunk_document(text: str, chunk_size: int = 800, overlap: int = 200) -> list[dict]:
    """Split document text into overlapping chunks by paragraph boundaries."""
    paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
    chunks = []
    current_text = ""
    chunk_index = 0

    for para in paragraphs:
        if len(current_text) + len(para) + 2 > chunk_size and current_text:
            chunks.append({"text": current_text.strip(), "index": chunk_index})
            chunk_index += 1
            words = current_text.split()
            overlap_words = words[-overlap // 4:] if len(words) > overlap // 4 else words
            current_text = " ".join(overlap_words) + " " + para
        else:
            current_text += " " + para

    if current_text.strip():
        chunks.append({"text": current_text.strip(), "index": chunk_index})

    return chunks


# ────────────────────────── Main ──────────────────────────

async def main():
    # 1. Get the firm UUID from the firms table
    pool = await get_pool()
    async with pool.acquire() as conn:
        firm_row = await conn.fetchrow("SELECT id, name FROM firms LIMIT 1")
        if not firm_row:
            logger.error("No firm found in the database! Please seed first.")
            return
        firm_id = str(firm_row["id"])
        firm_name = firm_row["name"]
        logger.info("Using firm: %s (%s)", firm_name, firm_id)

        docs_rows = await conn.fetch("SELECT id, filename FROM documents LIMIT 5")
        doc_ids = [str(r["id"]) for r in docs_rows]
        logger.info("Found %d existing documents", len(doc_ids))

    # 2. Drop and recreate document_chunks with correct schema
    pool2 = await get_pool()
    async with pool2.acquire() as conn:
        logger.info("Dropping existing document_chunks table...")
        await conn.execute("DROP TABLE IF EXISTS document_chunks CASCADE")
        logger.info("Creating document_chunks with 768-dim vector...")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.execute("""
            CREATE TABLE document_chunks (
                id           TEXT PRIMARY KEY,
                document_id  TEXT NOT NULL,
                firm_id      TEXT NOT NULL,
                chunk_index  INTEGER NOT NULL,
                text         TEXT NOT NULL,
                section_title TEXT,
                page_number  INTEGER,
                embedding    vector(384),
                metadata     JSONB DEFAULT '{}'::jsonb,
                created_at   TIMESTAMPTZ DEFAULT NOW(),
                updated_at   TIMESTAMPTZ DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_dc_document_id ON document_chunks(document_id)
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_dc_firm_id ON document_chunks(firm_id)
        """)
        # Only create ivfflat index if not empty
        logger.info("Table created.")

    # 3. Index sample documents
    total_indexed = 0
    for i, doc in enumerate(SAMPLE_DOCS):
        doc_id = f"sample-{i+1:02d}"
        logger.info("[%d/%d] Indexing: %s", i+1, len(SAMPLE_DOCS), doc["title"])

        chunks = chunk_document(doc["text"])
        logger.info("  → %d chunks", len(chunks))

        texts = [c["text"] for c in chunks]
        try:
            embeddings = await embedder.embed(texts)
            logger.info("  → %d embeddings (dim=%d)", len(embeddings), len(embeddings[0]) if embeddings else 0)
        except Exception as e:
            logger.error("  → Embedding failed: %s", e)
            continue

        # Direct insert via asyncpg (simpler than retriever which expects matter_id)
        async with pool2.acquire() as conn:
            import uuid as _uuid
            async with conn.transaction():
                for ci, (chunk, emb) in enumerate(zip(chunks, embeddings)):
                    chunk_id = f"{doc_id}-chunk-{ci}"
                    vector_str = "[" + ",".join(str(v) for v in emb) + "]"
                    await conn.execute(
                        """
                        INSERT INTO document_chunks (id, document_id, firm_id, chunk_index, text, section_title, embedding)
                        VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        chunk_id, doc_id, firm_id, ci, chunk["text"],
                        None, vector_str,
                    )
                    total_indexed += 1

        logger.info("  → %d chunks stored", len(chunks))

    logger.info("=== Total chunks indexed: %d ===", total_indexed)

    # 4. Verify retrieval
    test_embedding = await embedder.embed_query("non-disclosure and confidentiality obligations")
    async with pool2.acquire() as conn:
        vector_str = "[" + ",".join(str(v) for v in test_embedding) + "]"
        rows = await conn.fetch("""
            SELECT id, text, 1 - (embedding <=> $1::vector) AS similarity
            FROM document_chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> $1
            LIMIT 3
        """, vector_str)

    logger.info("Verification search ('non-disclosure'): %d results", len(rows))
    for r in rows:
        logger.info("  → [%s] similarity=%.4f: %s...", r["id"], r["similarity"], r["text"][:80])

    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
