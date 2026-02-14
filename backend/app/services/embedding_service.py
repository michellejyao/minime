"""OpenAI embedding generation (no LangChain)."""

from openai import AsyncOpenAI

from app.config import get_settings

EMBEDDING_MODEL = "text-embedding-3-small"


async def get_embedding(text: str) -> list[float]:
    """Return embedding vector for a single string."""
    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    resp = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text,
    )
    return resp.data[0].embedding


async def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Return embedding vectors for multiple strings (batch)."""
    if not texts:
        return []
    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    resp = await client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
    )
    # Preserve order by index (API returns in same order)
    by_index = {d.index: d.embedding for d in resp.data}
    return [by_index[i] for i in range(len(texts))]
