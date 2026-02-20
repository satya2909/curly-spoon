import os
import re
import torch
from peft import PeftModel
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    AutoModelForSequenceClassification
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# -------- Globals (lazy-loaded) --------
tokenizer = None
ate_model = None
asc_model = None

def load_models():
    global tokenizer, ate_model, asc_model

    if tokenizer is not None:
        return  # already loaded

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    PROJECT_ROOT = os.path.dirname(BASE_DIR)

    ATE_PATH = os.path.join(PROJECT_ROOT, "models", "ate_lora")
    ASC_PATH = os.path.join(PROJECT_ROOT, "models", "asc_lora")

    # ---- DeBERTa tokenizer ----
    tokenizer = AutoTokenizer.from_pretrained(
        "microsoft/deberta-v3-base",
        use_fast=True
    )

    # ---- ATE (token classification) ----
    ate_base = AutoModelForTokenClassification.from_pretrained(
        "microsoft/deberta-v3-base",
        num_labels=3,
        id2label={0: "O", 1: "B-ASP", 2: "I-ASP"},
        label2id={"O": 0, "B-ASP": 1, "I-ASP": 2},
        low_cpu_mem_usage=True
    )

    ate_model = PeftModel.from_pretrained(
        ate_base,
        ATE_PATH,
        local_files_only=True
    ).to(DEVICE)
    ate_model.eval()

    # ---- ASC (sequence classification) ----
    asc_base = AutoModelForSequenceClassification.from_pretrained(
        "microsoft/deberta-v3-base",
        num_labels=3,
        low_cpu_mem_usage=True
    )

    asc_model = PeftModel.from_pretrained(
        asc_base,
        ASC_PATH,
        local_files_only=True
    ).to(DEVICE)
    asc_model.eval()


# -------- ATE --------
def extract_aspects(text: str):
    enc = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        max_length=512
    ).to(DEVICE)

    with torch.no_grad():
        logits = ate_model(**enc).logits

    preds = torch.argmax(logits, dim=-1)[0].cpu().tolist()
    word_ids = enc.word_ids()

    input_ids = enc["input_ids"][0].cpu().tolist()
    tokens = tokenizer.convert_ids_to_tokens(input_ids)

    aspects = []
    current = []

    for wid, label, tok in zip(word_ids, preds, tokens):
        if wid is None:
            continue

        clean_tok = tok.replace("▁", "").replace("##", "")

        if label == 1:  # B-ASP
            if current:
                aspects.append(" ".join(current))
            current = [clean_tok]

        elif label == 2 and current:  # I-ASP
            current.append(clean_tok)

        else:
            if current:
                aspects.append(" ".join(current))
                current = []

    if current:
        aspects.append(" ".join(current))

    return list(set(aspects))



# -------- ASC --------
def classify_sentiment(text: str, aspect: str):
    pair = f"{aspect} [SEP] {text}"

    inputs = tokenizer(
        pair,
        return_tensors="pt",
        truncation=True,
        max_length=512
    ).to(DEVICE)

    with torch.no_grad():
        logits = asc_model(**inputs).logits

    probs = torch.softmax(logits, dim=-1)
    conf, label = torch.max(probs, dim=-1)
    
    label_idx = label.item()
    confidence = int(conf.item() * 100) # Convert 0.95 -> 95

    sentiment = {0: "negative", 1: "neutral", 2: "positive"}[label_idx]
    return sentiment, confidence


# -------- MAIN ABSA PIPELINE --------
def run_absa(transcript: str):
    load_models()

    transcript = re.sub(r"\[.*?\]", "", transcript)

    aspects = extract_aspects(transcript)

    results = []
    for asp in aspects:
        sentiment, conf = classify_sentiment(transcript, asp)
        results.append({
            "aspect": asp,
            "sentiment": sentiment,
            "confidence": conf
        })

    return results
