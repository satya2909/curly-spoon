import re, unidecode

FILLERS = ["uh", "um", "you know", "like"]

def normalize(text):
    text = unidecode.unidecode(text.lower())
    for f in FILLERS:
        text = text.replace(f, "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()
