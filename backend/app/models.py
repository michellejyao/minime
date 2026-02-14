"""SQLAlchemy models for Digital Twin AI."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from pgvector.sqlalchemy import Vector

from app.db import EMBEDDING_DIMENSION, Base


class Memory(Base):
    """A single memory (e.g. an experience or note) with optional chunks."""

    __tablename__ = "memories"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    memory_type: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    chunks: Mapped[list["MemoryChunk"]] = relationship(
        "MemoryChunk",
        back_populates="memory",
        cascade="all, delete-orphan",
    )


class MemoryChunk(Base):
    """A chunk of a memory with its embedding for vector search."""

    __tablename__ = "memory_chunks"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    memory_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("memories.id", ondelete="CASCADE"),
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(
        Vector(EMBEDDING_DIMENSION),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    memory: Mapped["Memory"] = relationship("Memory", back_populates="chunks")

    __table_args__ = (
        Index(
            "ix_memory_chunks_embedding_cosine",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class Conversation(Base):
    """A chat conversation (optional container for messages)."""

    __tablename__ = "conversations"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class Message(Base):
    """A single message in a conversation (user or assistant)."""

    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    conversation_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # 'user' | 'assistant'
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    conversation: Mapped["Conversation"] = relationship(
        "Conversation",
        back_populates="messages",
    )


class PersonalityProfile(Base):
    """
    Big Five (OCEAN) personality scores from BFI-10.
    One row per user/app installation.
    """

    __tablename__ = "personality_profiles"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    # OCEAN scores (1-5 scale, average of 2 items per trait)
    openness: Mapped[float] = mapped_column(nullable=False)  # O
    conscientiousness: Mapped[float] = mapped_column(nullable=False)  # C
    extraversion: Mapped[float] = mapped_column(nullable=False)  # E
    agreeableness: Mapped[float] = mapped_column(nullable=False)  # A
    neuroticism: Mapped[float] = mapped_column(nullable=False)  # N
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )


class InterviewSession(Base):
    """A single interview practice session."""

    __tablename__ = "interview_sessions"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    questions: Mapped[list["InterviewQuestion"]] = relationship(
        "InterviewQuestion",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    answers: Mapped[list["InterviewAnswer"]] = relationship(
        "InterviewAnswer",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class InterviewQuestion(Base):
    """A question in an interview session (auto-generated or custom)."""

    __tablename__ = "interview_questions"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    session_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    session: Mapped["InterviewSession"] = relationship(
        "InterviewSession", back_populates="questions"
    )
    answers: Mapped[list["InterviewAnswer"]] = relationship(
        "InterviewAnswer",
        back_populates="question",
        cascade="all, delete-orphan",
    )


class InterviewAnswer(Base):
    """User's answer to an interview question with feedback and improved version."""

    __tablename__ = "interview_answers"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )
    session_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("interview_questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_answer: Mapped[str] = mapped_column(Text, nullable=False)
    transcribed_text: Mapped[str] = mapped_column(Text, nullable=True)
    feedback: Mapped[str] = mapped_column(Text, nullable=True)
    improved_answer: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    session: Mapped["InterviewSession"] = relationship(
        "InterviewSession", back_populates="answers"
    )
    question: Mapped["InterviewQuestion"] = relationship(
        "InterviewQuestion", back_populates="answers"
    )
