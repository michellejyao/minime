"""Interview Simulation: sessions, questions from memories, answer analysis with RAG."""

from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models import (
    InterviewAnswer,
    InterviewQuestion,
    InterviewSession,
    MemoryChunk,
)
from app.schemas import (
    InterviewAnswerOut,
    InterviewFeedbackResponse,
    InterviewQuestionCreate,
    InterviewQuestionOut,
    InterviewSessionOut,
)
from app.services.chat_service import get_relevant_chunks
from app.services.embedding_service import get_embedding

LLM_MODEL = "gpt-4o-mini"
TOP_K_CHUNKS = 5
DEFAULT_QUESTIONS_FROM_MEMORIES = 5


def _build_memory_context(chunks: list[tuple[str, str]]) -> str:
    """Format retrieved chunks for prompts."""
    if not chunks:
        return "(No relevant memories retrieved.)"
    parts = []
    for i, (content, _) in enumerate(chunks, 1):
        parts.append(f"[Memory {i}]\n{content.strip()}")
    return "\n\n".join(parts)


ANALYSIS_PROMPT = """You are an expert interview coach. You have access to the user's own memory context (facts and experiences they have stored). Your job is to:

1. Evaluate their interview answer given the QUESTION and their MEMORY CONTEXT.
2. Provide structured, actionable feedback (2-4 short bullet points). Focus on: clarity, relevance to the question, use of concrete examples from their memories, and any gaps or improvements.
3. Write an improved version of their answer that stays in first person, uses their memory context where relevant, and is concise and interview-appropriate.

Output strictly in this format (no extra text before or after):

---FEEDBACK---
(bullet points here)
---IMPROVED---
(improved answer text here, first person, using their context)
"""


async def create_session(session: AsyncSession) -> InterviewSessionOut:
    """Create a new interview session."""
    s = InterviewSession()
    session.add(s)
    await session.flush()
    return InterviewSessionOut.model_validate(s)


async def get_session(
    session: AsyncSession, session_id: UUID
) -> InterviewSessionOut | None:
    """Get a session by id."""
    stmt = (
        select(InterviewSession)
        .where(InterviewSession.id == session_id)
        .options(
            selectinload(InterviewSession.questions),
            selectinload(InterviewSession.answers),
        )
    )
    result = await session.execute(stmt)
    s = result.scalar_one_or_none()
    return InterviewSessionOut.model_validate(s) if s else None


async def list_sessions(session: AsyncSession) -> list[InterviewSessionOut]:
    """List all sessions ordered by created_at desc."""
    stmt = select(InterviewSession).order_by(desc(InterviewSession.created_at))
    result = await session.execute(stmt)
    sessions = result.scalars().all()
    return [InterviewSessionOut.model_validate(s) for s in sessions]


async def generate_questions_from_memories(
    db: AsyncSession, session_id: UUID, count: int = DEFAULT_QUESTIONS_FROM_MEMORIES
) -> list[InterviewQuestionOut]:
    """
    Generate interview questions from the user's memory chunks using LLM.
    Embeds a generic query to fetch diverse memories, then asks the LLM to turn them into questions.
    """
    # Use a broad query to get a mix of memories
    query_embedding = await get_embedding(
        "professional experience skills projects achievements education background"
    )
    chunk_results = await get_relevant_chunks(db, query_embedding, top_k=min(10, count * 2))
    if not chunk_results:
        return []

    chunks_with_content = [(c.content, c) for c, _ in chunk_results]
    memory_context = _build_memory_context(chunks_with_content)

    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    completion = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {
                "role": "system",
                "content": "You generate realistic interview questions (behavioral and situational) that the candidate could answer using the given memory context. One question per line, no numbering. Keep each question to one or two sentences.",
            },
            {
                "role": "user",
                "content": f"Memory context:\n{memory_context}\n\nGenerate exactly {count} distinct interview questions that this person could answer using their own experiences above. Output only the questions, one per line.",
            },
        ],
    )
    text = completion.choices[0].message.content or ""
    lines = [line.strip() for line in text.strip().split("\n") if line.strip()][:count]

    stmt = select(InterviewSession).where(InterviewSession.id == session_id)
    res = await db.execute(stmt)
    sess = res.scalar_one_or_none()
    if not sess:
        return []

    out = []
    for qtext in lines:
        q = InterviewQuestion(session_id=session_id, question_text=qtext)
        db.add(q)
        await db.flush()
        out.append(InterviewQuestionOut.model_validate(q))
    return out


async def add_custom_question(
    db: AsyncSession, session_id: UUID, payload: InterviewQuestionCreate
) -> InterviewQuestionOut | None:
    """Add a custom interview question to a session."""
    stmt = select(InterviewSession).where(InterviewSession.id == session_id)
    res = await db.execute(stmt)
    if res.scalar_one_or_none() is None:
        return None
    q = InterviewQuestion(session_id=session_id, question_text=payload.question_text)
    db.add(q)
    await db.flush()
    return InterviewQuestionOut.model_validate(q)


async def get_questions_for_session(
    db: AsyncSession, session_id: UUID
) -> list[InterviewQuestionOut]:
    """List all questions for a session."""
    stmt = (
        select(InterviewQuestion)
        .where(InterviewQuestion.session_id == session_id)
        .order_by(InterviewQuestion.created_at)
    )
    result = await db.execute(stmt)
    questions = result.scalars().all()
    return [InterviewQuestionOut.model_validate(q) for q in questions]


async def submit_answer(
    db: AsyncSession,
    session_id: UUID,
    question_id: UUID,
    user_answer: str,
    transcribed_text: str | None = None,
) -> InterviewFeedbackResponse:
    """
    Store the user's answer, retrieve top 5 memory chunks by embedding the answer,
    run LLM analysis for feedback and improved answer, persist and return.
    """
    # Validate session and question
    stmt_s = select(InterviewSession).where(InterviewSession.id == session_id)
    stmt_q = select(InterviewQuestion).where(
        InterviewQuestion.id == question_id,
        InterviewQuestion.session_id == session_id,
    )
    res_s = await db.execute(stmt_s)
    res_q = await db.execute(stmt_q)
    sess = res_s.scalar_one_or_none()
    question = res_q.scalar_one_or_none()
    if not sess or not question:
        raise ValueError("Session or question not found")

    # Retrieve relevant memories using user's answer
    query_embedding = await get_embedding(user_answer)
    chunk_results = await get_relevant_chunks(db, query_embedding, top_k=TOP_K_CHUNKS)
    chunks_with_content = [(c.content, c) for c, _ in chunk_results]
    memory_context = _build_memory_context(chunks_with_content)

    # LLM: structured feedback + improved answer
    client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    user_block = f"""## Memory context (use to ground feedback and improved answer)
{memory_context}

## Interview question
{question.question_text}

## User's answer
{user_answer}
"""
    completion = await client.chat.completions.create(
        model=LLM_MODEL,
        messages=[
            {"role": "system", "content": ANALYSIS_PROMPT},
            {"role": "user", "content": user_block},
        ],
    )
    response_text = completion.choices[0].message.content or ""
    feedback = ""
    improved = ""
    if "---FEEDBACK---" in response_text and "---IMPROVED---" in response_text:
        parts = response_text.split("---IMPROVED---", 1)
        feedback_part = parts[0].split("---FEEDBACK---", 1)[-1].strip()
        improved = parts[1].strip() if len(parts) > 1 else ""
        feedback = feedback_part
    else:
        feedback = response_text[:2000]
        improved = ""

    # Persist answer record
    answer = InterviewAnswer(
        session_id=session_id,
        question_id=question_id,
        user_answer=user_answer,
        transcribed_text=transcribed_text,
        feedback=feedback or None,
        improved_answer=improved or None,
    )
    db.add(answer)
    await db.flush()

    return InterviewFeedbackResponse(
        answer_id=answer.id,
        feedback=feedback,
        improved_answer=improved,
        retrieved_memory_count=len(chunk_results),
    )


async def get_answer(
    db: AsyncSession, answer_id: UUID
) -> InterviewAnswerOut | None:
    """Get a single answer by id."""
    stmt = select(InterviewAnswer).where(InterviewAnswer.id == answer_id)
    result = await db.execute(stmt)
    a = result.scalar_one_or_none()
    return InterviewAnswerOut.model_validate(a) if a else None


async def get_session_with_questions(
    db: AsyncSession, session_id: UUID
) -> tuple[InterviewSessionOut | None, list[InterviewQuestionOut]]:
    """Get session and its questions. Returns (session, questions) or (None, [])."""
    stmt = (
        select(InterviewSession)
        .where(InterviewSession.id == session_id)
        .options(selectinload(InterviewSession.questions))
    )
    result = await db.execute(stmt)
    sess = result.scalar_one_or_none()
    if not sess:
        return None, []
    questions = sorted(sess.questions, key=lambda q: q.created_at)
    return InterviewSessionOut.model_validate(sess), [
        InterviewQuestionOut.model_validate(q) for q in questions
    ]
