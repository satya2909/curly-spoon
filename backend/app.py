from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from groq import Groq

from modules.downloader import fetch_audio, fetch_metadata
from modules.asr import transcribe
from modules.normalize import normalize
from modules.gatekeeper import classify
from modules.absa import run_absa
from modules.text_cleaner import remove_timestamps
from modules.opinion_filter import llm_filter_opinions


# -------------------- ENV + CLIENT --------------------

load_dotenv()

client = None
if os.getenv("GROQ_API_KEY"):
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# -------------------- APP SETUP --------------------

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------- REQUEST SCHEMA --------------------

class Req(BaseModel):
    url: str
    use_llm: bool = False   # toggle for demo / evaluation


# -------------------- LLM HELPERS --------------------

def llm_refine_text(text: str) -> str:
    """
    Light grammar cleanup after opinion filtering
    """
    if client is None or not text.strip():
        return text

    prompt = f"""
Clean the following text.
Fix transcription errors but do NOT add new information.

Text:
{text}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1
    )

    return response.choices[0].message.content.strip()


def llm_run_absa(text: str):
    """
    LLM-based ABSA (qualitative evaluation mode)
    """
    if client is None or not text.strip():
        return []

    prompt = f"""
Perform Aspect-Based Sentiment Analysis.

Return JSON array ONLY in this format:
[
  {{
    "aspect": "...",
    "sentiment": "positive | negative | neutral"
  }}
]

Text:
{text}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    return response.choices[0].message.content.strip()


# -------------------- ROUTES --------------------

@app.get("/")
def root():
    return {"status": "ABSA backend running"}


@app.post("/analyze")
def analyze(req: Req):
    print("\n==============================")
    print("NEW ANALYSIS REQUEST")
    print(f"URL: {req.url}")
    print(f"LLM Enabled: {req.use_llm}")

    # -------- Data Acquisition --------
    title = fetch_metadata(req.url)
    wav = fetch_audio(req.url)

    # -------- ASR --------
    raw = transcribe(wav)
    clean = normalize(raw)
    clean = remove_timestamps(clean)

    # -------- ROUTING (IMPORTANT: BEFORE FILTERING) --------
    routing = classify(clean)

    print(f"Title: {title}")
    print(
        f"Route: {'ABSA' if routing['is_food'] else 'GENERAL'} "
        f"| Confidence: {routing['confidence']}"
    )

    # -------- OPINION FILTERING --------
    if routing["is_food"] and req.use_llm and client is not None:
        clean = llm_filter_opinions(clean, client)
        clean = llm_refine_text(clean)

    print("\nTEXT SENT TO ABSA:")
    print(clean if clean else "[NO OPINION SENTENCES FOUND]")

    # -------- ABSA PATH --------
    if routing["is_food"]:

        if not clean.strip():
            return {
                "route": "ABSA",
                "engine": "LLM" if req.use_llm else "CUSTOM",
                "confidence": routing["confidence"],
                "absa_result": [],
                "note": "No opinion-bearing sentences detected"
            }

        if req.use_llm and client is not None:
            result = llm_run_absa(clean)
            engine = "LLM"
        else:
            result = run_absa(clean)
            engine = "CUSTOM"

        print("\nABSA RESULT:")
        print(result if result else "[EMPTY RESULT]")

        print("==============================\n")

        return {
            "route": "ABSA",
            "engine": engine,
            "confidence": routing["confidence"],
            "absa_result": result
        }

    # -------- GENERAL CONTENT --------
    else:
        print("GENERAL CONTENT")
        print("==============================\n")

        return {
            "route": "GENERAL",
            "confidence": routing["confidence"],
            "clean_transcript": clean
        }
