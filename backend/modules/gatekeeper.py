import torch
from transformers import pipeline

clf = None

def get_classifier():
    global clf
    if clf is None:
        print("Loading gatekeeper model (RoBERTa)...")
        clf = pipeline(
            "sentiment-analysis",
            model="cardiffnlp/twitter-roberta-base-sentiment",
            framework="pt",
            device=0 if torch.cuda.is_available() else -1
        )
    return clf

DOMAIN_KEYWORDS = {
    "food": [
        "food", "restaurant", "hotel", "cafe", "dish", "menu",
        "service", "staff", "meal", "chef", "dining", "buffet"
    ],
    "travel": [
        "travel", "trip", "journey", "flight", "airport", "tour",
        "vacation", "holiday", "destination"
    ],
    "tech": [
        "phone", "laptop", "software", "app", "battery",
        "camera", "screen", "performance"
    ]
}

ABSA_DOMAINS = {"food"}

def detect_domain(text: str):
    text_l = text.lower()
    scores = {d: sum(1 for k in ks if k in text_l)
              for d, ks in DOMAIN_KEYWORDS.items()}

    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "general", 0.0

    return best, round(scores[best] / len(DOMAIN_KEYWORDS[best]), 3)


def classify(text: str):
    domain, dom_conf = detect_domain(text)

    if domain not in ABSA_DOMAINS:
        return {
            "is_food": False,
            "domain": domain,
            "confidence": dom_conf
        }

    # lightweight semantic confirmation
    classifier = get_classifier()
    result = classifier(text[:512])[0]

    return {
        "is_food": result["score"] > 0.5,
        "domain": domain,
        "confidence": round(result["score"], 3)
    }
