"""Digital Twin AI backend — FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import (
    chat_router,
    conversations_router,
    interview_router,
    memory_router,
    personality_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create pgvector extension and tables on startup."""
    await init_db()
    yield
    # Shutdown: nothing to do


app = FastAPI(
    title="Digital Twin AI",
    description="Persistent identity system with memory embeddings and grounded chat.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(memory_router.router)
app.include_router(chat_router.router)
app.include_router(conversations_router.router)
app.include_router(personality_router.router)
app.include_router(interview_router.router)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check for load balancers and monitoring."""
    return {"status": "ok"}
