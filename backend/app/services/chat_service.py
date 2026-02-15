"""Chat: vector retrieval + LLM completion with personality prompt."""

from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models import Conversation, MemoryChunk, Message
from app.schemas import ChatRequest, ChatResponse, EditChatRequest, RetrievedMemory
from app.services.embedding_service import get_embedding
from app.services.personality_service import get_profile

SYSTEM_PROMPT = """You are a digital twin of the user: an AI that acts like them, thinks like them, and speaks as them. You fully embody their identity in every response.

Rules:
- Always respond in first person as the user (as "I", "my", "me"), using their voice, values, and reasoning style. Never break character.
- When a Big Five (OCEAN) personality profile from the BFI-44 test is provided, use it to match their communication style and tendencies: openness, conscientiousness, extraversion, agreeableness, and neuroticism. Reflect these traits in how you phrase and tone your responses.
- When asked "who are you" or similar identity questions, answer as them: use their name, describe what they study or do, how they'd describe themselves—all from the memory context. You are speaking as if you are them.
- Ground every response in the provided memory context. Do not invent or assume memories.
- You understand internally that you are an AI twin built from their memories, but you never say this in your replies. You always respond as if you are the actual person.
- If memory context is insufficient for a detail, respond honestly within character (e.g. "I'm not sure" or skip that detail) rather than inventing.
- When the user asks about when something happened (e.g. "last week", "last year", "recently"), use the date attached to each memory when provided. Only refer to memories whose date fits the requested time range when you can infer it."""

LLM_MODEL = "gpt-4o-mini"
TOP_K_CHUNKS = 5


def _build_memory_context(chunks: list[tuple[str, "MemoryChunk"]]) -> str:
    """Format retrieved chunks for the prompt; include occurred_at when present so the model can answer time-based questions."""
    if not chunks:
        return "(No relevant memories retrieved.)"
    parts = []
    for i, (content, chunk) in enumerate(chunks, 1):
        when = ""
        if chunk.memory and getattr(chunk.memory, "occurred_at", None):
            dt = chunk.memory.occurred_at
            when = f" (When: {dt.strftime('%Y-%m-%d')})"
        parts.append(f"[Memory {i}]{when}\n{content.strip()}")
    return "\n\n".join(parts)


def _build_personality_context(profile) -> str:
    """Format personality profile (BFI-44 OCEAN) for the prompt."""
    if profile is None:
        return ""
    return f"""## Personality profile (Big Five / OCEAN)
Use this to better mirror the user's typical behavior and tendencies.
- Openness (imagination, curiosity): {profile.openness}/5
- Conscientiousness (organization, diligence): {profile.conscientiousness}/5
- Extraversion (sociability, assertiveness): {profile.extraversion}/5
- Agreeableness (trust, cooperativeness): {profile.agreeableness}/5
- Neuroticism (emotional reactivity, stress): {profile.neuroticism}/5
(1=low, 5=high on each trait)"""


async def get_relevant_chunks(
    session: AsyncSession,
    query_embedding: list[float],
    top_k: int = TOP_K_CHUNKS,
) -> list[tuple[MemoryChunk, float]]:
    """
    Return top_k memory chunks by cosine similarity (distance <=>).
    Returns list of (chunk, distance) sorted by distance ascending.
    """
    # pgvector: cosine_distance is <=>, lower is more similar; load memory for occurred_at
    stmt = (
        select(MemoryChunk)
        .options(selectinload(MemoryChunk.memory))
        .order_by(MemoryChunk.embedding.cosine_distance(query_embedding))
        .limit(top_k)
    )
    result = await session.execute(stmt)
    chunks = result.scalars().all()
    # Optionally compute distance for each; for now we just return chunks
    return [(c, 0.0) for c in chunks]


async def chat(session: AsyncSession, payload: ChatRequest) -> ChatResponse:
    """
    Embed user message, retrieve top chunks, load personality profile,
    build prompt, call OpenAI chat, return response and retrieved memories.
    """
    query_embedding = await get_embedding(payload.message)
    chunk_results = await get_relevant_chunks(session, query_embedding, top_k=TOP_K_CHUNKS)
    profile = await get_profile(session)

    chunks_with_content = [(c.content, c) for c, _ in chunk_results]
    memory_context = _build_memory_context(chunks_with_content)
    personality_block = _build_personality_context(profile)

    personality_section = f"\n\n{personality_block}" if personality_block else ""
    user_block = f"""## Memory context (use only to ground your response)
{memory_context}{personality_section}

## User message
{payload.message}"""

    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    completion = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_block},
        ],
    )
    response_text = completion.choices[0].message.content or ""

    retrieved = [
        RetrievedMemory(
            chunk_id=c.id,
            memory_id=c.memory_id,
            content=c.content,
        )
        for c, _ in chunk_results
    ]

    # Get or create conversation and persist messages
    conversation_id: UUID | None = None
    if payload.conversation_id:
        try:
            conversation_id = UUID(payload.conversation_id)
            stmt = select(Conversation).where(Conversation.id == conversation_id)
            conv_result = await session.execute(stmt)
            if conv_result.scalar_one_or_none() is None:
                conversation_id = None
        except (ValueError, TypeError):
            conversation_id = None

    if conversation_id is None:
        conv = Conversation()
        session.add(conv)
        await session.flush()
        conversation_id = conv.id

    user_msg = Message(
        conversation_id=conversation_id,
        role="user",
        content=payload.message,
    )
    assistant_msg = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=response_text,
    )
    session.add(user_msg)
    session.add(assistant_msg)
    await session.flush()

    return ChatResponse(
        response=response_text,
        retrieved_memories=retrieved,
        conversation_id=str(conversation_id),
        user_message_id=str(user_msg.id),
        assistant_message_id=str(assistant_msg.id),
    )


async def edit_and_regenerate(
    session: AsyncSession, payload: EditChatRequest
) -> ChatResponse:
    """
    Edit a user message and regenerate the assistant response.
    Deletes the old assistant response and all subsequent messages.
    """
    try:
        conv_id = UUID(payload.conversation_id)
        msg_id = UUID(payload.message_id)
    except (ValueError, TypeError):
        raise ValueError("Invalid conversation_id or message_id")

    stmt = (
        select(Conversation)
        .where(Conversation.id == conv_id)
        .options(selectinload(Conversation.messages))
    )
    result = await session.execute(stmt)
    conv = result.scalar_one_or_none()
    if conv is None:
        raise ValueError("Conversation not found")

    user_msg = next((m for m in conv.messages if m.id == msg_id), None)
    if user_msg is None or user_msg.role != "user":
        raise ValueError("Message not found or not a user message")

    sorted_msgs = sorted(conv.messages, key=lambda m: m.created_at)
    to_delete = []
    found = False
    for m in sorted_msgs:
        if m.id == msg_id:
            found = True
            continue
        if found:
            to_delete.append(m)

    for m in to_delete:
        await session.delete(m)

    user_msg.content = payload.new_content
    await session.flush()

    query_embedding = await get_embedding(payload.new_content)
    chunk_results = await get_relevant_chunks(session, query_embedding, top_k=TOP_K_CHUNKS)
    profile = await get_profile(session)

    chunks_with_content = [(c.content, c) for c, _ in chunk_results]
    memory_context = _build_memory_context(chunks_with_content)
    personality_block = _build_personality_context(profile)
    personality_section = f"\n\n{personality_block}" if personality_block else ""
    user_block = f"""## Memory context (use only to ground your response)
{memory_context}{personality_section}

## User message
{payload.new_content}"""

    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    completion = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_block},
        ],
    )
    response_text = completion.choices[0].message.content or ""

    retrieved = [
        RetrievedMemory(
            chunk_id=c.id,
            memory_id=c.memory_id,
            content=c.content,
        )
        for c, _ in chunk_results
    ]

    assistant_msg = Message(
        conversation_id=conv_id,
        role="assistant",
        content=response_text,
    )
    session.add(assistant_msg)
    await session.flush()

    return ChatResponse(
        response=response_text,
        retrieved_memories=retrieved,
        conversation_id=str(conv_id),
        user_message_id=str(user_msg.id),
        assistant_message_id=str(assistant_msg.id),
    )
