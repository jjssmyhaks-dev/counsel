import sys, asyncio, os
sys.path.insert(0, r'C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform\services\ai\src')
os.chdir(r'C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform\services\ai\src')
import importlib
db = importlib.import_module('db.client')

async def main():
    pool = await db.get_pool()
    rows = await pool.fetch("SELECT id, document_id, substring(text,1,60) as preview FROM document_chunks LIMIT 5")
    print(f"Chunks in DB: {len(rows)}")
    for r in rows[:3]:
        print(f"  doc={r['document_id']} text={r['preview']}")

asyncio.run(main())
