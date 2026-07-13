from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/counsel"
    embedding_model: str = "@cf/baai/bge-base-en-v1.5"  # Cloudflare Workers AI
    embedding_dim: int = 768
    api_port: int = 8000
    llm_provider: str = "cloudflare"  # stub, openai, anthropic, cloudflare
    llm_api_key: str = ""
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_text_model: str = "@cf/meta/llama-4-scout-17b-16e-instruct"
    max_chunk_size: int = 2000
    chunk_overlap: int = 200
    similarity_threshold: float = 0.7

    class Config:
        env_file = ".env"


settings = Settings()
