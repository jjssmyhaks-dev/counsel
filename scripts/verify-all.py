import asyncio, asyncpg, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from src.config import settings

async def main():
    pool = await asyncpg.create_pool(settings.database_url, min_size=1, max_size=3)
    async with pool.acquire() as conn:
        c = await conn.fetchval("SELECT COUNT(*) FROM document_chunks WHERE embedding IS NOT NULL")
        print(f"pgvector chunks indexed: {c}")
        rows = await conn.fetch("SELECT document_id, COUNT(*) as cnt FROM document_chunks WHERE embedding IS NOT NULL GROUP BY document_id ORDER BY document_id")
        for row in rows:
            print(f"  {row['document_id']}: {row['cnt']} chunks")

        # Check vector dim
        emb = await conn.fetchval("SELECT embedding FROM document_chunks WHERE embedding IS NOT NULL LIMIT 1")
        print(f"Embedding dimension: {emb.shape[0]}")

    # Check audit log
    log_path = os.path.join(os.path.dirname(__file__), '..', 'logs', 'audit-2026-07-16.jsonl')
    if os.path.exists(log_path):
        with open(log_path) as f:
            lines = f.readlines()
        print(f"\nAudit log entries: {len(lines)}")
        import json
        for line in lines[-3:]:
            e = json.loads(line)
            print(f"  {e['timestamp']} | {e['action']} | {e['resource_id']} | success={e['success']}")
    else:
        print("No audit log found")

    await pool.close()

asyncio.run(main())
