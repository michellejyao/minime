"""Interview Simulation Mode: sessions, questions from memories, speech answers, feedback, voice."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas import (
    InterviewAnswerOut,
    InterviewAnswerSubmit,
    InterviewFeedbackResponse,
    InterviewQuestionCreate,
    InterviewQuestionOut,
    InterviewSessionOut,
)
from app.services import interview_service, speech_service, voice_service

router = APIRouter(prefix="/interview", tags=["interview"])


@router.post("/sessions", response_model=InterviewSessionOut)
async def create_session(
    session: AsyncSession = Depends(get_db),
) -> InterviewSessionOut:
    """Create a new interview practice session."""
    return await interview_service.create_session(session)


@router.get("/sessions", response_model=list[InterviewSessionOut])
async def list_sessions(
    session: AsyncSession = Depends(get_db),
) -> list[InterviewSessionOut]:
    """List all interview sessions."""
    return await interview_service.list_sessions(session)


@router.get("/sessions/{session_id}", response_model=InterviewSessionOut)
async def get_session(
    session_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> InterviewSessionOut:
    """Get an interview session by id."""
    out = await interview_service.get_session(session, session_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return out


@router.get("/sessions/{session_id}/questions", response_model=list[InterviewQuestionOut])
async def get_session_questions(
    session_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> list[InterviewQuestionOut]:
    """List questions for a session."""
    sess, questions = await interview_service.get_session_with_questions(
        session, session_id
    )
    if sess is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return questions


@router.post(
    "/sessions/{session_id}/questions/generate",
    response_model=list[InterviewQuestionOut],
)
async def generate_questions(
    session_id: UUID,
    count: int = 5,
    session: AsyncSession = Depends(get_db),
) -> list[InterviewQuestionOut]:
    """Generate interview questions from the user's stored memories."""
    sess, _ = await interview_service.get_session_with_questions(session, session_id)
    if sess is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return await interview_service.generate_questions_from_memories(
        session, session_id, count=min(max(1, count), 20)
    )


@router.post(
    "/sessions/{session_id}/questions",
    response_model=InterviewQuestionOut,
)
async def add_custom_question(
    session_id: UUID,
    payload: InterviewQuestionCreate,
    session: AsyncSession = Depends(get_db),
) -> InterviewQuestionOut:
    """Add a custom interview question to the session."""
    out = await interview_service.add_custom_question(
        session, session_id, payload
    )
    if out is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return out


@router.post(
    "/sessions/{session_id}/questions/{question_id}/answer",
    response_model=InterviewFeedbackResponse,
)
async def submit_answer_text(
    session_id: UUID,
    question_id: UUID,
    payload: InterviewAnswerSubmit,
    session: AsyncSession = Depends(get_db),
) -> InterviewFeedbackResponse:
    """Submit a text answer; returns structured feedback and improved answer."""
    try:
        return await interview_service.submit_answer(
            session,
            session_id,
            question_id,
            user_answer=payload.answer_text,
            transcribed_text=None,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/sessions/{session_id}/questions/{question_id}/answer/speech",
    response_model=InterviewFeedbackResponse,
)
async def submit_answer_speech(
    session_id: UUID,
    question_id: UUID,
    audio: UploadFile = File(...),
    voice_option: str = Form("female"),
    session: AsyncSession = Depends(get_db),
) -> InterviewFeedbackResponse:
    """
    Upload audio of your answer. It is transcribed, analyzed with memory context,
    then the improved answer is spoken back in the chosen voice.
    voice_option: "female" | "male" | "neutral" | "clone"
    """
    import base64
    import logging

    logger = logging.getLogger(__name__)

    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")
    filename = audio.filename or "audio.webm"
    transcribed = await speech_service.transcribe_audio(content, filename)
    if not transcribed:
        raise HTTPException(
            status_code=400, detail="Could not transcribe audio; check format (e.g. webm, mp3, wav)."
        )
    try:
        result = await interview_service.submit_answer(
            session,
            session_id,
            question_id,
            user_answer=transcribed,
            transcribed_text=transcribed,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Normalize voice option; default to female if invalid
    option = (voice_option or "female").strip().lower()
    if option not in ("female", "male", "neutral", "clone"):
        option = "female"

    improved_audio_base64: str | None = None
    improved_audio_error: str | None = None
    if result.improved_answer:
        try:
            audio_bytes, fallback_msg = await voice_service.text_to_speech_for_interview(
                result.improved_answer,
                voice_option=option,
                audio_bytes=content if option == "clone" else None,
            )
            improved_audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
            improved_audio_error = fallback_msg
        except ValueError as e:
            improved_audio_error = "ElevenLabs not configured. Add ELEVENLABS_API_KEY to .env."
            logger.warning("Interview voice: %s", e)
        except Exception as e:
            improved_audio_error = str(e)[:200]
            logger.exception("Interview TTS failed")

    return InterviewFeedbackResponse(
        answer_id=result.answer_id,
        feedback=result.feedback,
        improved_answer=result.improved_answer,
        retrieved_memory_count=result.retrieved_memory_count,
        improved_audio_base64=improved_audio_base64,
        improved_audio_error=improved_audio_error,
    )


@router.get("/answers/{answer_id}", response_model=InterviewAnswerOut)
async def get_answer(
    answer_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> InterviewAnswerOut:
    """Get a stored answer with feedback and improved answer."""
    out = await interview_service.get_answer(session, answer_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    return out


@router.get("/answers/{answer_id}/improved-audio")
async def get_improved_answer_audio(
    answer_id: UUID,
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Return the improved answer as audio (ElevenLabs cloned voice). Requires ELEVENLABS_API_KEY."""
    out = await interview_service.get_answer(session, answer_id)
    if out is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    if not out.improved_answer:
        raise HTTPException(
            status_code=404, detail="No improved answer available for this record"
        )
    try:
        audio_bytes = await voice_service.text_to_speech(out.improved_answer)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={"Content-Disposition": "inline; filename=improved-answer.mp3"},
    )
