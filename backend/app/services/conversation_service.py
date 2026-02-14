"""Conversation listing and message retrieval."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Conversation, Message


async def list_conversations(session: AsyncSession) -> list[dict]:
    """
    List conversations ordered by created_at desc.
    Title is derived from the first user message (truncated) or "New conversation".
    """
    stmt = (
        select(Conversation)
        .order_by(Conversation.created_at.desc())
        .options(selectinload(Conversation.messages))
    )
    result = await session.execute(stmt)
    conversations = result.scalars().all()

    out = []
    for conv in conversations:
        user_msgs = sorted(
            (m for m in conv.messages if m.role == "user"),
            key=lambda x: x.created_at,
        )
        title = "New conversation"
        if user_msgs:
            content = user_msgs[0].content.strip()
            title = content[:60] + "…" if len(content) > 60 else content or title
        out.append(
            {
                "id": str(conv.id),
                "title": title,
                "created_at": conv.created_at.isoformat() if conv.created_at else None,
            }
        )
    return out


async def get_conversation_messages(
    session: AsyncSession, conversation_id: UUID
) -> list[dict] | None:
    """
    Get messages for a conversation, ordered by created_at.
    Returns None if conversation does not exist.
    """
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await session.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is None:
        return None

    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    result = await session.execute(stmt)
    messages = result.scalars().all()

    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]


async def delete_conversation(
    session: AsyncSession, conversation_id: UUID
) -> bool:
    """
    Delete a conversation and its messages (cascade).
    Returns True if deleted, False if not found.
    """
    stmt = select(Conversation).where(Conversation.id == conversation_id)
    result = await session.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is None:
        return False
    await session.delete(conv)
    return True
