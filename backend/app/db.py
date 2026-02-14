"""Database engine, session factory, and lifecycle."""

import socket
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

from app.config import get_settings

DB_CONNECTION_HELP = (
    "Check SUPABASE_DB_URL in .env: use the URI from Supabase Dashboard → "
    "Project Settings → Database → Connection string (URI), then change "
    "postgresql:// to postgresql+asyncpg://. Ensure the host is correct (e.g. "
    "db.xxxxx.supabase.co) and your network can reach Supabase."
)


class Base(DeclarativeBase):
    """Declarative base for all models."""


# Embedding dimension for OpenAI text-embedding-3-small (default)
EMBEDDING_DIMENSION = 1536


def get_engine():
    """Create async engine from SUPABASE_DB_URL."""
    settings = get_settings()
    return create_async_engine(
        settings.supabase_db_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
    )


engine = get_engine()


def get_session_factory():
    """Create async session factory bound to engine."""
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


async_session_factory = get_session_factory()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that yields an async session and closes it after use."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Create pgvector extension and all tables. Safe to call on startup."""
    import app.models  # noqa: F401 — register models with Base.metadata

    try:
        # Ensure extension exists (Supabase usually has it enabled)
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except socket.gaierror as e:
        raise RuntimeError(
            f"Database connection failed: could not resolve database host (getaddrinfo failed). "
            f"{DB_CONNECTION_HELP}"
        ) from e
    except OSError as e:
        raise RuntimeError(
            f"Database connection failed: {e!s}. {DB_CONNECTION_HELP}"
        ) from e
