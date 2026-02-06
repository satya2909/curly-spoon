import torch
from datasets import load_dataset
from transformers import BertTokenizerFast, BertForSequenceClassification, Trainer, TrainingArguments
from peft import get_peft_model, LoraConfig, TaskType
from backend.training.noise_augment import inject_noise

MODEL = "bert-base-uncased"

# Load CSV directly
dataset = load_dataset("csv", data_files="data/asc_data.csv")   # put your csv here

tokenizer = BertTokenizerFast.from_pretrained(MODEL)

label_map = {"negative": 0, "neutral": 1, "positive": 2}

def preprocess(x):
    noisy = inject_noise(x["sentence"])
    pair = x["aspect"] + " [SEP] " + noisy
    t = tokenizer(pair, truncation=True, padding="max_length", max_length=128)
    t["labels"] = label_map[x["sentiment"].lower()]
    return t

dataset = dataset.map(preprocess)

base = BertForSequenceClassification.from_pretrained(MODEL, num_labels=3)

model = get_peft_model(base, LoraConfig(task_type=TaskType.SEQ_CLS, r=8, lora_alpha=32))

args = TrainingArguments(
    output_dir="models/asc_lora",
    per_device_train_batch_size=16,
    num_train_epochs=4,
    learning_rate=2e-4,
    fp16=torch.cuda.is_available(),
    save_strategy="epoch",
    logging_steps=50,
)

trainer = Trainer(model=model, args=args, train_dataset=dataset["train"])
trainer.train()

model.save_pretrained("models/asc_lora")
tokenizer.save_pretrained("models/asc_lora")
