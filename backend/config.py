"""Settings, read once from the environment / .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATA_DIR = ROOT / "data"
FRONTEND_DIST = ROOT / "frontend" / "dist"
LOG_DIR = ROOT / "logs"

# gemini | groq | claude | local   ("local" = no LLM, keyword answers straight from the content)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "gemini").strip().lower()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
# Fast lite model first (answers in ~4 s); bigger models as fallbacks when it is busy.
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
GEMINI_FALLBACKS = [m.strip() for m in os.getenv(
    "GEMINI_FALLBACKS", "gemini-3.8-flash,gemini-3.1-flash-lite,gemini-flash-latest").split(",") if m.strip()]
GEMINI_THINKING = os.getenv("GEMINI_THINKING", "low").strip()
GEMINI_VISION_MODELS = [m.strip() for m in os.getenv(
    "GEMINI_VISION_MODELS", "gemini-3.8-flash,gemini-3.5-flash,gemini-3.5-flash-lite").split(",") if m.strip()]

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5").strip()

# Photo recognition thresholds
MATCH_CONFIDENCE = float(os.getenv("MATCH_CONFIDENCE", "0.75"))
AMBIGUOUS_CONFIDENCE = float(os.getenv("AMBIGUOUS_CONFIDENCE", "0.35"))
