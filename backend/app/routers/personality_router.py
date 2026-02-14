"""Personality (BFI-10 / OCEAN) endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas import PersonalityProfileOut, PersonalityTestSubmit
from app.services.personality_service import get_profile, save_profile

router = APIRouter(prefix="/personality", tags=["personality"])


@router.get("", response_model=PersonalityProfileOut | None)
async def get_personality(
    session: AsyncSession = Depends(get_db),
) -> PersonalityProfileOut | None:
    """Return the latest personality profile, or null if none exists."""
    return await get_profile(session)


@router.post("", response_model=PersonalityProfileOut)
async def post_personality(
    payload: PersonalityTestSubmit,
    session: AsyncSession = Depends(get_db),
) -> PersonalityProfileOut:
    """
    Submit BFI-44 answers (44 integers 1-5), compute OCEAN scores, save profile.
    """
    try:
        return await save_profile(session, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
