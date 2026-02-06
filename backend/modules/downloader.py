import yt_dlp
import os
import uuid

DOWNLOAD_DIR = "data"

def fetch_audio(url: str) -> str:
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    uid = str(uuid.uuid4())
    output = os.path.join(DOWNLOAD_DIR, f"{uid}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output,
        "quiet": True,
        "noplaylist": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192"
        }]
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)

    return os.path.splitext(filename)[0] + ".wav"


def fetch_metadata(url: str) -> str:
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    return (info.get("title", "") + " " + info.get("description", "")).strip()
import yt_dlp
import os
import uuid

DOWNLOAD_DIR = "downloads"

def fetch_audio(url: str) -> str:
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)

    uid = str(uuid.uuid4())
    output = os.path.join(DOWNLOAD_DIR, f"{uid}.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output,
        "quiet": True,
        "noplaylist": True,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192"
        }]
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info)

    return os.path.splitext(filename)[0] + ".wav"


def fetch_metadata(url: str) -> str:
    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)

    return (info.get("title", "") + " " + info.get("description", "")).strip()
