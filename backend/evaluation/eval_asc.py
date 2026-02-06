import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from peft import PeftModel
from sklearn.metrics import classification_report

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL = "microsoft/deberta-v3-base"

tokenizer = AutoTokenizer.from_pretrained("models/asc_lora")
base = AutoModelForSequenceClassification.from_pretrained(MODEL, num_labels=3)
model = PeftModel.from_pretrained(base, "models/asc_lora").to(DEVICE)
model.eval()

df = pd.read_csv("data/asc_test.csv")

label_map = {"negative":0, "neutral":1, "positive":2}
preds, gold = [], []

for _, r in df.iterrows():
    text = r["aspect"] + " [SEP] " + r["sentence"]
    inp = tokenizer(text, return_tensors="pt", truncation=True).to(DEVICE)
    with torch.no_grad():
        logits = model(**inp).logits
    preds.append(torch.argmax(logits).item())
    gold.append(label_map[r["sentiment"].lower()])

print(classification_report(gold, preds, target_names=["neg","neu","pos"]))
