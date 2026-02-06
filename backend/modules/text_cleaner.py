import re

TIMESTAMP_PATTERN = r"\[\d{2}:\d{2}\.\d{2}-\d{2}:\d{2}\.\d{2}\]"

def remove_timestamps(text: str) -> str:
    text = re.sub(TIMESTAMP_PATTERN, "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()
