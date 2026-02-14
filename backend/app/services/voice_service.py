"""Text-to-speech using ElevenLabs (cloned voice)."""

import asyncio

from elevenlabs.client import ElevenLabs

from app.config import get_settings


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
    # Default: Rachel (clear, professional)
    return "21m00Tcm4TlvDq8ikWAM"


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
        return client.text_to_speech.convert(
            voice_id=vid,
            text=text,
            model_id=model_id,
            output_format=output_format,
        )

    return await asyncio.to_thread(_convert)
