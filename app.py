from pathlib import Path
import os
import shutil
import subprocess
import tempfile
import threading
import time
import webbrowser

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
INDEX_FILE = STATIC_DIR / "index.html"

app = FastAPI(title="KSBRC Board Meeting Analyzer")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def home():
    return FileResponse(INDEX_FILE)


@app.get("/api/version")
def version():
    return {"version": "V31", "charts": "restored"}


def _ffmpeg_ok():
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except Exception:
        return False


def _whisper_ok():
    try:
        import whisper  # noqa: F401
        return True
    except Exception:
        return False


@app.get("/api/status")
def status():
    return {
        "whisper": _whisper_ok(),
        "ffmpeg": _ffmpeg_ok(),
        "ready": _whisper_ok() and _ffmpeg_ok(),
    }


@app.post("/api/transcribe")
async def transcribe(file: UploadFile = File(...)):
    if not _whisper_ok():
        return JSONResponse(
            status_code=500,
            content={"error": "Whisper is not installed. Run: pip install openai-whisper"},
        )
    if not _ffmpeg_ok():
        return JSONResponse(
            status_code=500,
            content={"error": "FFmpeg is not available. Install FFmpeg and ensure it is on PATH."},
        )

    import whisper

    suffix = Path(file.filename or "audio.webm").suffix or ".webm"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_path = tmp.name
            shutil.copyfileobj(file.file, tmp)

        model_name = os.environ.get("KSBRC_WHISPER_MODEL", "base")
        model = whisper.load_model(model_name)
        result = model.transcribe(tmp_path, fp16=False)
        text = (result.get("text") or "").strip()
        return {"text": text, "model": model_name}
    except Exception as exc:
        return JSONResponse(status_code=500, content={"error": str(exc)})
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def _open_browser(url: str):
    def runner():
        time.sleep(1.2)
        try:
            webbrowser.open(url)
        except Exception:
            pass
    threading.Thread(target=runner, daemon=True).start()


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("KSBRC_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("KSBRC_PORT", "8000")))
    local_host = "127.0.0.1" if host == "0.0.0.0" else host
    url = f"http://{local_host}:{port}"
    if os.environ.get("KSBRC_NO_BROWSER") != "1":
        _open_browser(url)
    uvicorn.run(app, host=host, port=port)
