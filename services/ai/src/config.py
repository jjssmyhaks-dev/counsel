from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/counsel"
    embedding_model: str = "all-MiniLM-L6-v2"  # local, no API key
    embedding_dim: int = 384
    api_port: int = 8000
    llm_provider: str = "stub"  # stub, openai, anthropic, cloudflare
    llm_api_key: str = ""
    max_chunk_size: int = 2000
    chunk_overlap: int = 200
    similarity_threshold: float = 0.7

    class Config:
        env_file = ".env"


settings = Settings()
