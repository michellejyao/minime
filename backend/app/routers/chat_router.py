"""Chat endpoint."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas import ChatRequest, ChatResponse, EditChatRequest
from app.services.chat_service import chat, edit_and_regenerate

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def post_chat(
    payload: ChatRequest,
    session: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Answer using retrieved memories: embed message, vector search top 5 chunks,
    then generate response with OpenAI using personality prompt.
    """
    return await chat(session, payload)


@router.post("/edit", response_model=ChatResponse)
async def post_chat_edit(
    payload: EditChatRequest,
    session: AsyncSession = Depends(get_db),
) -> ChatResponse:
    """
    Edit a user message, delete the old assistant response and subsequent messages,
    then regenerate a new response.
    """
    try:
        return await edit_and_regenerate(session, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
