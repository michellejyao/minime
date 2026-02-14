"""Pydantic request/response schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ----- Memory -----


class MemoryCreate(BaseModel):
    """Request body for POST /memory."""

    title: str = Field(..., min_length=1, max_length=512)
    content: str = Field(..., min_length=1)
    memory_type: str = Field(..., min_length=1, max_length=128)


class MemoryChunkOut(BaseModel):
    """A single chunk (e.g. for retrieved memories)."""

    id: UUID
    memory_id: UUID
    chunk_index: int
    content: str

    model_config = {"from_attributes": True}


class MemoryOut(BaseModel):
    """Response for a created or returned memory."""

    id: UUID
    title: str
    content: str
    memory_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ----- Chat -----


class ChatRequest(BaseModel):
    """Request body for POST /chat."""

    message: str = Field(..., min_length=1)
    conversation_id: str | None = None  # If None, creates a new conversation


class RetrievedMemory(BaseModel):
    """One retrieved memory chunk for chat context."""

    chunk_id: UUID
    memory_id: UUID
    content: str


class ChatResponse(BaseModel):
    """Response for POST /chat."""

    response: str
    retrieved_memories: list[RetrievedMemory] = Field(default_factory=list)
    conversation_id: str | None = None  # ID of the conversation (new or existing)
    user_message_id: str | None = None  # ID of the created user message
    assistant_message_id: str | None = None  # ID of the created assistant message


class EditChatRequest(BaseModel):
    """Request body for POST /chat/edit."""

    conversation_id: str = Field(..., min_length=1)
    message_id: str = Field(..., min_length=1)
    new_content: str = Field(..., min_length=1)


# ----- Personality (BFI-44 / OCEAN) -----


class PersonalityTestSubmit(BaseModel):
    """Request body for POST /personality. Raw answers 1-5 for BFI-44 items."""

    answers: list[int] = Field(..., min_length=44, max_length=44)


class PersonalityProfileOut(BaseModel):
    """Response for GET/POST /personality."""

    openness: float
    conscientiousness: float
    extraversion: float
    agreeableness: float
    neuroticism: float
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ----- Interview Simulation -----


class InterviewSessionOut(BaseModel):
    """Response for a created or returned interview session."""

    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewQuestionOut(BaseModel):
    """A single interview question in a session."""

    id: UUID
    session_id: UUID
    question_text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewQuestionCreate(BaseModel):
    """Request body for adding a custom interview question."""

    question_text: str = Field(..., min_length=1)


class InterviewAnswerOut(BaseModel):
    """Response for a submitted answer with feedback and improved version."""

    id: UUID
    session_id: UUID
    question_id: UUID
    user_answer: str
    transcribed_text: str | None
    feedback: str | None
    improved_answer: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class InterviewAnswerSubmit(BaseModel):
    """Request body for submitting an answer (text)."""

    answer_text: str = Field(..., min_length=1)


class InterviewFeedbackResponse(BaseModel):
    """Structured feedback and improved answer returned after analysis."""

    answer_id: UUID
    feedback: str
    improved_answer: str
    retrieved_memory_count: int