"""Memory ingestion: chunking, embedding, and persistence."""

import tiktoken
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import EMBEDDING_DIMENSION
from app.models import Memory, MemoryChunk
from app.schemas import MemoryCreate, MemoryOut
from app.services.embedding_service import get_embeddings

# Chunk size target: 300–500 tokens
CHUNK_MIN_TOKENS = 300
CHUNK_MAX_TOKENS = 500
CHUNK_TARGET_TOKENS = 400

# cl100k_base is used by text-embedding-3-small and gpt-4o-mini
_ENCODING = tiktoken.get_encoding("cl100k_base")


def _chunk_text_by_tokens(text: str) -> list[str]:
    """Split text into chunks of approximately CHUNK_TARGET_TOKENS tokens."""
    tokens = _ENCODING.encode(text)
    if len(tokens) <= CHUNK_MAX_TOKENS:
        return [text] if tokens else []

    chunks: list[str] = []
    start = 0
    while start < len(tokens):
        end = min(start + CHUNK_TARGET_TOKENS, len(tokens))
        # Prefer splitting at sentence boundary (.). If not, use chunk boundary.
        if end < len(tokens):
            segment = _ENCODING.decode(tokens[start:end])
            last_period = segment.rfind(". ")
            if last_period > len(segment) // 2:
                end = start + len(_ENCODING.encode(segment[: last_period + 1]))
        chunk_tokens = tokens[start:end]
        chunks.append(_ENCODING.decode(chunk_tokens))
        start = end
    return chunks


async def list_memories(session: AsyncSession) -> list[MemoryOut]:
    """Return all memories ordered by created_at desc."""
    stmt = select(Memory).order_by(desc(Memory.created_at))
    result = await session.execute(stmt)
    memories = result.scalars().all()
    return [MemoryOut.model_validate(m) for m in memories]


async def ingest_memory(session: AsyncSession, payload: MemoryCreate) -> MemoryOut:
    """
    Create a memory, split content into chunks, embed chunks, store memory and chunks.
    """
    memory = Memory(
        title=payload.title,
        content=payload.content,
        memory_type=payload.memory_type,
        occurred_at=payload.occurred_at,
    )
    session.add(memory)
    await session.flush()

    chunk_texts = _chunk_text_by_tokens(payload.content)
    if not chunk_texts:
        return MemoryOut.model_validate(memory)

    embeddings = await get_embeddings(chunk_texts)
    for i, (content, embedding) in enumerate(zip(chunk_texts, embeddings)):
        chunk = MemoryChunk(
            memory_id=memory.id,
            chunk_index=i,
            content=content,
            embedding=embedding,
        )
        session.add(chunk)

    await session.flush()
    return MemoryOut.model_validate(memory)
