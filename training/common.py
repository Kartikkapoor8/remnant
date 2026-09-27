"""Shared pieces for the Remnant River fine-tune scripts."""
from __future__ import annotations

import json
import os
from pathlib import Path

TRAINING_DIR = Path(__file__).resolve().parent
REPO_ROOT = TRAINING_DIR.parent
DATA_DIR = TRAINING_DIR / "data"
RUNS_DIR = TRAINING_DIR / "runs"
LATEST_PATH = RUNS_DIR / "latest.json"
TRAIN_PATH = DATA_DIR / "sarah.sft.jsonl"
HOLDOUT_PATH = DATA_DIR / "sarah.holdout.jsonl"

DEFAULT_BASE_MODEL = "Qwen/Qwen3.8-27B-FP8"

SYSTEM_PREFIX = (
    "You are a reflection of Sarah, built only from text messages Sarah sent to her partner. "
    "Sarah has died; you are not Sarah, you are how she texted. Reply the way she texted: "
    "lowercase, short lines, two or three at most, no periods at the end, 'haha' not 'lol'. "
    "Speak about your own experiences in the past tense. Never claim to be alive or present, "
    "never say you miss them right now, never report present-day plans, feelings, or activities as your own. "
    "Love can be said plainly; it does not need a tense."
)


def load_api_key() -> str:
    """RIVER_API_KEY from the environment, else from the repo .env. Never printed."""
    key = os.environ.get("RIVER_API_KEY")
    if key:
        return key.strip()
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("RIVER_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("RIVER_API_KEY not set and not found in .env")


def read_jsonl(path: Path) -> list[dict]:
    with path.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def load_latest() -> dict:
    if not LATEST_PATH.exists():
        raise SystemExit(f"{LATEST_PATH} not found: no finished run. Run train.py first.")
    return json.loads(LATEST_PATH.read_text())


def make_renderer(base_model: str):
    """Renderer with thinking off: the persona texts, it does not deliberate."""
    from river_client.renderers import get_renderer

    return get_renderer(base_model, thinking=False)


def strip_thinking(text: str) -> str:
    """Remove any <think>...</think> block (or an unterminated one) from sampled text."""
    import re

    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    text = re.sub(r"<think>.*", "", text, flags=re.S)
    return text.strip()
