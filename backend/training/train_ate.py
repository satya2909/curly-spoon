from transformers import BertForTokenClassification, BertTokenizer
from peft import get_peft_model, LoraConfig, TaskType
from datasets import load_dataset

model = BertForTokenClassification.from_pretrained("bert-base-uncased", num_labels=3)
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")

config = LoraConfig(
    task_type=TaskType.TOKEN_CLS,
    r=8,
    lora_alpha=32,
    lora_dropout=0.1
)

model = get_peft_model(model, config)

# TODO: Load SemEval restaurant dataset + noise augmented data
