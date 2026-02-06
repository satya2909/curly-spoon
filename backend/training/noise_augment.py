# backend/training/noise_augment.py
import random, re

def inject_noise(text):
    words = text.split()
    for i in range(len(words)):
        if random.random() < 0.12:
            words[i] = random.choice(["uh","um","er"])
    return " ".join(words)
