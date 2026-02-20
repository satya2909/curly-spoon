import sys
try:
    import fastapi
    import uvicorn
    import ffmpeg
    import torch
    print("Verification Successful: Key libraries imported.")
except ImportError as e:
    print(f"Verification Failed: {e}")
    sys.exit(1)
