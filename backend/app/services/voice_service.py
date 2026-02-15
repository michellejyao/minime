"""Text-to-speech using ElevenLabs (cloned or premade voices)."""

import asyncio
import uuid

from elevenlabs.client import ElevenLabs

from app.config import get_settings

# Premade ElevenLabs voices (available on all plans for TTS)
VOICE_FEMALE = "FGY2WhTYpPnrIDTdsKH5"   # Laura: sunny enthusiasm, quirky attitude – expressive & positive
VOICE_MALE = "pNInz6obpgDQGcFmaJgB"     # Adam
VOICE_NEUTRAL = "IKne3meq5aSn9XLyUdCD"  # Charlie
VOICE_DEFAULT_FALLBACK = VOICE_FEMALE   # Used when IVC fails (e.g. missing permission)


def _get_client() -> ElevenLabs:
    """Return ElevenLabs client; raises if API key not configured."""
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise ValueError(
            "ElevenLabs is not configured. Set ELEVENLABS_API_KEY and optionally "
            "ELEVENLABS_VOICE_ID in .env for interview voice clone."
        )
    return ElevenLabs(api_key=settings.elevenlabs_api_key)


def get_voice_id() -> str:
    """Return configured voice ID or a default clone-capable voice."""
    settings = get_settings()
    if settings.elevenlabs_voice_id:
        return settings.elevenlabs_voice_id
    return VOICE_FEMALE


def get_voice_id_for_option(option: str) -> str:
    """Return ElevenLabs voice_id for interview voice option (female, male, neutral)."""
    return {
        "female": VOICE_FEMALE,
        "male": VOICE_MALE,
        "neutral": VOICE_NEUTRAL,
    }.get(option, VOICE_DEFAULT_FALLBACK)


def get_cloned_voice_id_from_env() -> str | None:
    """Return the user's cloned voice ID from .env (cloned on ElevenLabs website). None if not set."""
    settings = get_settings()
    vid = (settings.elevenlabs_voice_id or "").strip()
    return vid if vid else None


async def text_to_speech(
    text: str,
    voice_id: str | None = None,
    model_id: str = "eleven_multilingual_v2",
    output_format: str = "mp3_44100_128",
) -> bytes:
    """
    Convert text to speech using ElevenLabs with the given or configured voice.
    Returns raw audio bytes (e.g. MP3).
    """
    client = _get_client()
    vid = voice_id or get_voice_id()

    def _convert() -> bytes:
        # SDK returns an iterator of chunks; join into bytes for base64 / response
        chunks = client.text_to_speech.convert(
            voice_id=vid,
            text=text,
            model_id=model_id,
            output_format=output_format,
        )
        return b"".join(chunks)

    return await asyncio.to_thread(_convert)


async def create_instant_voice_from_audio(
    audio_bytes: bytes,
    name: str | None = None,
) -> str:
    """
    Create an instant voice clone from the given audio using ElevenLabs IVC.
    Returns the new voice_id. Caller may use it for TTS then discard.
    """
    client = _get_client()
    name = name or f"interview-{uuid.uuid4().hex[:8]}"
    # SDK accepts File = bytes or (filename, content); use tuple so API knows format
    file_spec = ("audio.webm", audio_bytes)

    def _create() -> str:
        voice = client.voices.ivc.create(name=name, files=[file_spec])
        return voice.voice_id

    return await asyncio.to_thread(_create)


async def text_to_speech_in_voice_of_audio(
    text: str,
    audio_bytes: bytes,
    model_id: str = "eleven_multilingual_v2",
    output_format: str = "mp3_44100_128",
) -> bytes:
    """
    Clone the speaker from the given audio (IVC), then speak the text in that voice.
    If IVC fails (e.g. missing create_instant_voice_clone permission), fall back to default TTS.
    Returns raw MP3 bytes.
    """
    try:
        voice_id = await create_instant_voice_from_audio(audio_bytes)
        return await text_to_speech(
            text=text,
            voice_id=voice_id,
            model_id=model_id,
            output_format=output_format,
        )
    except Exception:
        # IVC not available (permission, plan, or format); use premade voice so user still hears audio
        return await text_to_speech(
            text=text,
            voice_id=VOICE_DEFAULT_FALLBACK,
            model_id=model_id,
            output_format=output_format,
        )


async def text_to_speech_for_interview(
    text: str,
    voice_option: str,
    audio_bytes: bytes | None = None,
    model_id: str = "eleven_multilingual_v2",
    output_format: str = "mp3_44100_128",
) -> tuple[bytes, str | None]:
    """
    Generate TTS for the improved interview answer.
    voice_option: "female" | "male" | "neutral" | "clone"
    Returns (audio_bytes, improved_audio_error). error is set when clone was requested but we fell back.
    For "clone": uses ELEVENLABS_VOICE_ID from .env (your voice cloned on ElevenLabs website) if set;
    otherwise tries instant voice clone from the recording (IVC), then falls back to default voice on failure.
    """
    if voice_option == "clone":
        # Prefer cloned voice from .env (created on ElevenLabs website)
        cloned_voice_id = get_cloned_voice_id_from_env()
        if cloned_voice_id:
            audio = await text_to_speech(
                text=text,
                voice_id=cloned_voice_id,
                model_id=model_id,
                output_format=output_format,
            )
            return audio, None
        # No .env voice ID: try instant voice clone from the user's recording (IVC). Kept for future use.
        if audio_bytes:
            try:
                voice_id = await create_instant_voice_from_audio(audio_bytes)
                audio = await text_to_speech(
                    text=text,
                    voice_id=voice_id,
                    model_id=model_id,
                    output_format=output_format,
                )
                return audio, None
            except Exception:
                audio = await text_to_speech(
                    text=text,
                    voice_id=VOICE_DEFAULT_FALLBACK,
                    model_id=model_id,
                    output_format=output_format,
                )
                return audio, "Cloned voice not available on your plan; played in default voice."
        # clone selected but no audio_bytes and no .env voice_id
        audio = await text_to_speech(
            text=text,
            voice_id=VOICE_DEFAULT_FALLBACK,
            model_id=model_id,
            output_format=output_format,
        )
        return audio, "Set ELEVENLABS_VOICE_ID in .env to use your cloned voice."
    voice_id = get_voice_id_for_option(voice_option)
    audio = await text_to_speech(
        text=text,
        voice_id=voice_id,
        model_id=model_id,
        output_format=output_format,
    )
    return audio, None
