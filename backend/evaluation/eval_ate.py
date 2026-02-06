import pandas as pd
import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification
from peft import PeftModel
from seqeval.metrics import classification_report

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL = "microsoft/deberta-v3-base"

tokenizer = AutoTokenizer.from_pretrained("ate_lora")
base = AutoModelForTokenClassification.from_pretrained(MODEL, num_labels=3)
model = PeftModel.from_pretrained(base, "ate_lora").to(DEVICE)
model.eval()

df = pd.read_csv("ate_test_final.csv")    # your final clean ATE dataset

preds, gold = [], []

for _, r in df.iterrows():
    words = r["sentence"].split()
    original_gold_tags = r["tags"].split() # Store original gold tags

    enc = tokenizer(
        words,
        is_split_into_words=True,
        truncation=True,
        padding="max_length",
        max_length=160,
        return_tensors="pt"
    ).to(DEVICE)

    with torch.no_grad():
        logits = model(**enc).logits

    pred_ids = torch.argmax(logits, dim=-1)[0].cpu().tolist()
    word_ids = enc.word_ids()

    pred_tags = []
    aligned_gold_tags = [] # New list for aligned gold tags

    for i, w in enumerate(word_ids):
        if w is not None:
            # Append predicted tag
            pred_tags.append(["O","B-ASP","I-ASP"][pred_ids[i]])
            # Append corresponding gold tag from original_gold_tags
            aligned_gold_tags.append(original_gold_tags[w])

    preds.append(pred_tags)
    gold.append(aligned_gold_tags) # Use aligned_gold_tags for evaluation

print(classification_report(gold, preds))
