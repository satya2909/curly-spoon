from faster_whisper import WhisperModel
import os
import dotenv
from groq import Groq

# -------------------- WHISPER SETUP --------------------

model = WhisperModel(
    "small",
    device="cpu",
    compute_type="int8"
)


# -------------------- OPTIONAL LLM CLIENT --------------------

client = None
if os.getenv("GROQ_API_KEY"):
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# -------------------- HELPERS --------------------

def format_time(sec: float) -> str:
    m = int(sec // 60)
    s = sec % 60
    return f"{m:02d}:{s:05.2f}"


def clean_asr_text(text: str) -> str:
    """
    Uses LLM to clean ASR output.
    This is OPTIONAL and only used when enabled from app.py
    """
    if client is None:
        return text   # fallback safely

    prompt = f"""
Correct transcription errors in the following ASR output.
Do NOT add new content or opinions.
Preserve meaning.

Text:
{text}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1
    )

    return response.choices[0].message.content


# -------------------- MAIN TRANSCRIPTION --------------------

def transcribe(wav_path: str) -> str:
    """
    Transcribes audio into timestamped text.
    """
    segments, _ = model.transcribe(wav_path)

    output = []
    for s in segments:
        start = format_time(s.start)
        end = format_time(s.end)
        output.append(f"[{start}-{end}] {s.text.strip()}")

    return "\n".join(output)
