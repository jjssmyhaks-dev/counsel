"""Direct pgvector indexing using Cloudflare Workers AI embeddings.

Avoids the complex embedder module and uses httpx directly.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import httpx

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from src.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

CF_ACCOUNT = settings.cloudflare_account_id
CF_TOKEN = settings.cloudflare_api_token
EMBED_MODEL = settings.embedding_model  # @cf/baai/bge-base-en-v1.5
EMBED_DIM = 768
EMBED_URL = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT}/ai/run/@cf/baai/bge-base-en-v1.5"

FIRM_ID = "ce7b93db-dc73-4407-a91c-450c128fa26f"  # Sterling & Associates

# ... same sample docs and chunk logic ...
SAMPLE_DOCS = [...]  # Will be filled from main script
