import sys, asyncio, os
os.chdir(r'C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform\services\ai')
sys.path.insert(0, 'src')
from src.config import settings
from src.db.client import get_pool
from src.embeddings.embedder import embedder
from src.rag.retriever import retriever

async def main():
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, document_id, substring(text,1,60) as preview FROM document_chunks LIMIT 5")
    print(f"Chunks in DB: {len(rows)}")
    for r in rows[:3]:
        print(f"  doc={r['document_id']} text={r['preview']}")

    # Search
    query = "indemnification basket amount"
    print(f"\nSearching: '{query}'")
    embedding = await embedder.embed([query])
    results = await retriever.search_by_embedding(embedding[0], "3a8c2d1e-4f5b-4e6d-9a1b-2c3d4e5f6a7b", top_k=3)
    print(f"Results: {len(results)}")
    for r in results:
        print(f"  sim={r.get('similarity', 0):.4f} text={r.get('text', '')[:100]}")

asyncio.run(main())
