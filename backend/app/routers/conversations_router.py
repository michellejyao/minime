"""Conversations and messages endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.conversation_service import (
    delete_conversation,
    get_conversation_messages,
    list_conversations,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("")
async def get_conversations(
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List recent conversations ordered by created_at desc."""
    return await list_conversations(session)


@router.get("/{conversation_id}/messages")
async def get_messages(
    conversation_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Get messages for a conversation."""
    messages = await get_conversation_messages(session, conversation_id)
    if messages is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return messages


@router.delete("/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    """Delete a conversation and its messages."""
    deleted = await delete_conversation(session, conversation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "ok"}
