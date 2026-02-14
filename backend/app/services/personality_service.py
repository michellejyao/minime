"""Personality profile service: BFI-44 scoring and persistence."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PersonalityProfile
from app.schemas import PersonalityProfileOut, PersonalityTestSubmit


# BFI-44 item mapping (John, Donahue, Kentle 1991). 1-indexed item -> (trait, reversed)
# E: 8 items (1,6,11,16,21,26,31,36), A: 9 (2,7,12,17,22,27,32,37,42), C: 9 (3,8,13,18,23,28,33,38,43)
# N: 8 (4,9,14,19,24,29,34,39), O: 10 (5,10,15,20,25,30,35,40,41,44)
# Reversed: 2,6,8,9,12,18,21,23,24,27,31,34,35,37,41,43
BFI_ITEM_ORDER = [
    "E", "A", "C", "N", "O",   # 1-5
    "E", "A", "C", "N", "O",   # 6-10
    "E", "A", "C", "N", "O",   # 11-15
    "E", "A", "C", "N", "O",   # 16-20
    "E", "A", "C", "N", "O",   # 21-25
    "E", "A", "C", "N", "O",   # 26-30
    "E", "A", "C", "N", "O",   # 31-35
    "E", "A", "C", "N", "O",   # 36-40
    "O", "A", "C", "O",        # 41-44 (O,A,C,O)
]
BFI_REVERSED = [
    False, True, False, False, False,  # 1-5
    True, False, True, True, False,    # 6-10
    False, True, False, False, False,  # 11-15
    False, False, True, False, False,  # 16-20
    True, False, True, True, False,    # 21-25
    False, True, False, False, False,  # 26-30
    True, False, False, True, True,    # 31-35
    False, True, False, False, True,   # 36-40
    True, False, True, False,          # 41-44
]


def compute_ocean_scores(answers: list[int]) -> dict[str, float]:
    """
    Compute OCEAN scores (1-5) from BFI-44 raw answers.
    Reversed items: score = 6 - raw. Each trait is the mean of its items.
    """
    if len(answers) != 44:
        raise ValueError("BFI-44 requires exactly 44 answers (1-5 each).")

    scores: dict[str, list[float]] = {"O": [], "C": [], "E": [], "A": [], "N": []}
    for i, raw in enumerate(answers):
        if not 1 <= raw <= 5:
            raise ValueError(f"Answer {i + 1} must be 1-5, got {raw}")
        s = 6 - raw if BFI_REVERSED[i] else raw
        trait = BFI_ITEM_ORDER[i]
        scores[trait].append(float(s))

    return {
        "openness": round(sum(scores["O"]) / len(scores["O"]), 2),
        "conscientiousness": round(sum(scores["C"]) / len(scores["C"]), 2),
        "extraversion": round(sum(scores["E"]) / len(scores["E"]), 2),
        "agreeableness": round(sum(scores["A"]) / len(scores["A"]), 2),
        "neuroticism": round(sum(scores["N"]) / len(scores["N"]), 2),
    }


async def get_profile(session: AsyncSession) -> PersonalityProfileOut | None:
    """Return the latest personality profile, or None."""
    stmt = (
        select(PersonalityProfile)
        .order_by(PersonalityProfile.created_at.desc())
        .limit(1)
    )
    result = await session.execute(stmt)
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return PersonalityProfileOut(
        openness=row.openness,
        conscientiousness=row.conscientiousness,
        extraversion=row.extraversion,
        agreeableness=row.agreeableness,
        neuroticism=row.neuroticism,
        created_at=row.created_at,
    )


async def save_profile(
    session: AsyncSession,
    payload: PersonalityTestSubmit,
) -> PersonalityProfileOut:
    """Compute OCEAN scores, save profile, return it."""
    scores = compute_ocean_scores(payload.answers)
    profile = PersonalityProfile(**scores)
    session.add(profile)
    await session.flush()
    await session.refresh(profile)
    return PersonalityProfileOut(
        openness=profile.openness,
        conscientiousness=profile.conscientiousness,
        extraversion=profile.extraversion,
        agreeableness=profile.agreeableness,
        neuroticism=profile.neuroticism,
        created_at=profile.created_at,
    )
