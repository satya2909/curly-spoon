from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from datetime import datetime
import json
from dotenv import load_dotenv
from groq import Groq
import pandas as pd
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



EXCEL_FILE = "absa_results.xlsx"
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
def parse_llm_json(response_text):
    try:
        return json.loads(response_text)
    except:
        # Attempt to extract JSON if extra text exists
        try:
            start = response_text.find("[")
            end = response_text.rfind("]") + 1
            return json.loads(response_text[start:end])
        except:
            return []

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

    prompt = f"""
You are an AI system that performs two tasks.

STEP 1 — Determine if the text is related to FOOD REVIEWS.

If the text discusses food, dishes, restaurants, taste, service of food etc:
    Perform Aspect-Based Sentiment Analysis.

If the text is NOT related to food:
    Provide a short summary (1–2 sentences).

OUTPUT FORMAT:

If FOOD related:
{{
  "type": "absa",
  "aspects": [
    {{
      "aspect": "<food_item>",
      "sentiment": "positive | negative | neutral"
    }}
  ]
}}

If NOT FOOD related:
{{
  "type": "summary",
  "summary": "<short summary>"
}}

IMPORTANT RULES:
- Identify EACH food item separately.
- Combine opinions for the same food item.
- Do NOT output explanations.
- Return ONLY valid JSON.

"confidence" should be an integer between 0 and 100 representing your certainty.

Text:
{text}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    try:
        content = response.choices[0].message.content.strip()
        # Clean up potential markdown code blocks
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        return json.loads(content.strip())
    except Exception as e:
        print(f"Error parsing LLM response: {e}")
        return []

def save_to_excel(restaurant, absa_results):
    rows = []

    for item in absa_results:
        rows.append({
            "Restaurant": restaurant,
            "Aspect": item.get("aspect"),
            "Score": item.get("score"),
            "Evidence": item.get("evidence"),
            "Timestamp": datetime.now()
        })

    if not rows:
        return

    df = pd.DataFrame(rows)

    if os.path.exists(EXCEL_FILE):
        existing = pd.read_excel(EXCEL_FILE)
        df = pd.concat([existing, df], ignore_index=True)

    df.to_excel(EXCEL_FILE, index=False)
# -------------------- ROUTES --------------------

@app.get("/")
def root():
    return {"status": "ABSA backend running"}


@app.post("/analyze")
def analyze(req: Req):

    print("\n==============================")
    print("NEW ANALYSIS REQUEST")
    print(f"URL: {req.url}")

    # -------------------- DATA ACQUISITION --------------------
    title = fetch_metadata(req.url)
    wav = fetch_audio(req.url)

    # -------------------- ASR --------------------
    raw = transcribe(wav)
    clean = normalize(raw)
    clean = remove_timestamps(clean)

    print(f"Title: {title}")

    if not clean.strip():
        return {
            "route": "EMPTY",
            "message": "Transcript is empty"
        }

    # -------------------- LLM ABSA --------------------

    if client is None:
        return {
            "error": "Please Try again"
        }

    prompt = f"""
You are an Aspect-Based Sentiment Analysis system specialized in food reviews.

IMPORTANT:
1. Identify EACH distinct food item mentioned.
2. Treat each food item separately.
3. Do NOT provide overall sentiment.
4. Extract the exact sentence that expresses sentiment.
5. Ignore items without sentiment.

Return JSON array ONLY in this format:

[
  {{
    "aspect": "<food_item_name>",
    "score": <integer from 1 to 10>,
    "evidence": "exact sentence from text"
  }}
]

Where "score" is a polarity rating from 1 (extremely negative) to 10 (extremely positive).
Use the full range: 1-3 = negative, 4-6 = neutral/mixed, 7-10 = positive.

Text:
{clean}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2
    )

    raw_output = response.choices[0].message.content.strip()

    print("\nRAW LLM OUTPUT:")
    print(raw_output)

    # -------------------- PARSE JSON --------------------
    parsed_result = parse_llm_json(raw_output)

    print("\nPARSED RESULT:")
    print(parsed_result if parsed_result else "[EMPTY OR INVALID JSON]")

    # -------------------- SAVE TO EXCEL --------------------
    try:
        save_to_excel(title, parsed_result)
    except Exception as e:
        print(f"[WARNING] Could not save to Excel: {e}")

    print("==============================\n")

    return {
        "route": "ABSA",
        "engine": "LLM",
        "restaurant": title,
        "absa_result": parsed_result
    }