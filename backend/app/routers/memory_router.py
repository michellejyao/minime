"""Memory ingestion and listing endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas import MemoryCreate, MemoryOut
from app.services.memory_service import ingest_memory, list_memories

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get("", response_model=list[MemoryOut])
async def get_memories(
    session: AsyncSession = Depends(get_db),
) -> list[MemoryOut]:
    """List all memories ordered by creation date."""
    return await list_memories(session)


@router.post("", response_model=MemoryOut)
async def post_memory(
    payload: MemoryCreate,
    session: AsyncSession = Depends(get_db),
) -> MemoryOut:
    """
    Ingest a memory: chunk content (~300–500 tokens), embed with OpenAI,
    store in memories and memory_chunks.
    """
    return await ingest_memory(session, payload)
