"""Speech-to-text transcription using OpenAI Whisper."""

import io

from openai import AsyncOpenAI

from app.config import get_settings


async def transcribe_audio(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    """
    Transcribe audio to text using OpenAI Whisper.
    Supports common formats (webm, mp3, m4a, wav, etc.) via the filename extension.
    """
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    file_like = io.BytesIO(audio_bytes)
    file_like.name = filename
    transcript = await client.audio.transcriptions.create(
        model="whisper-1",
        file=file_like,
    )
    return transcript.text.strip() if transcript.text else ""
