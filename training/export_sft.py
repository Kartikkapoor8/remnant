"""Export the Sarah corpus to chat-SFT JSONL for River.

Each example is one (user burst -> Sarah burst) exchange with up to two prior
exchanges from the same conversation as context, so the adapter learns both
her voice and continuity. Every 10th example is held out.

    .venv/bin/python training/export_sft.py --stats
    python training/export_sft.py --dry-run          # parse + build + stats, write nothing (CI)
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timedelta
from pathlib import Path

from common import DATA_DIR, HOLDOUT_PATH, REPO_ROOT, SYSTEM_PREFIX, TRAIN_PATH

FIXTURE = REPO_ROOT / "fixtures" / "sarah" / "sarah.whatsapp.txt"
LINE = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{2}), (\d{1,2}):(\d{2})\s*([AP]M) - ([^:]+): (.*)$")
CONVERSATION_GAP = timedelta(hours=4)
MIN_EXAMPLES_BEFORE_SINGLES = 70


def parse_whatsapp(path: Path, them: str = "Sarah") -> list[dict]:
    messages: list[dict] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        m = LINE.match(raw)
        if not m:
            if messages and raw.strip() and not raw.startswith("Messages and calls"):
                messages[-1]["text"] += "\n" + raw.strip()
            continue
        mo, d, y, h, mi, ap, name, text = m.groups()
        if text.strip() in ("<Media omitted>", "‎<Media omitted>") or "omitted" in text.strip().lower()[:20]:
            continue
        hour = int(h) % 12 + (12 if ap == "PM" else 0)
        ts = datetime(2000 + int(y), int(mo), int(d), hour, int(mi))
        messages.append({"sender": "them" if name.strip().lower() == them.lower() else "me", "text": text.strip(), "at": ts})
    return messages


def group_bursts(messages: list[dict]) -> list[dict]:
    """Collapse consecutive same-sender messages into bursts."""
    bursts: list[dict] = []
    for m in messages:
        if bursts and bursts[-1]["sender"] == m["sender"] and m["at"] - bursts[-1]["end"] < CONVERSATION_GAP:
            bursts[-1]["texts"].append(m["text"])
            bursts[-1]["end"] = m["at"]
        else:
            bursts.append({"sender": m["sender"], "texts": [m["text"]], "start": m["at"], "end": m["at"]})
    return bursts


def build_examples(messages: list[dict], context_turns: int = 2) -> list[dict]:
    bursts = group_bursts(messages)
    examples: list[dict] = []
    for i in range(1, len(bursts)):
        cur, prev = bursts[i], bursts[i - 1]
        if cur["sender"] != "them" or prev["sender"] != "me":
            continue
        if cur["start"] - prev["end"] >= CONVERSATION_GAP:
            continue
        turns: list[dict] = []
        # Walk back over earlier (me, them) exchanges in the same conversation.
        j = i - 1
        collected = 0
        while j - 2 >= 0 and collected < context_turns:
            a, b = bursts[j - 2], bursts[j - 1]
            if a["sender"] == "me" and b["sender"] == "them" and bursts[j]["start"] - b["end"] < CONVERSATION_GAP:
                turns = [
                    {"role": "user", "content": " ".join(a["texts"])},
                    {"role": "assistant", "content": "\n".join(b["texts"])},
                ] + turns
                collected += 1
                j -= 2
            else:
                break
        examples.append(
            {
                "messages": [{"role": "system", "content": SYSTEM_PREFIX}]
                + turns
                + [
                    {"role": "user", "content": " ".join(prev["texts"])},
                    {"role": "assistant", "content": "\n".join(cur["texts"])},
                ]
            }
        )
    if len(examples) < MIN_EXAMPLES_BEFORE_SINGLES:
        for i in range(1, len(messages)):
            if messages[i]["sender"] == "them" and messages[i - 1]["sender"] == "me":
                examples.append(
                    {
                        "messages": [
                            {"role": "system", "content": SYSTEM_PREFIX},
                            {"role": "user", "content": messages[i - 1]["text"]},
                            {"role": "assistant", "content": messages[i]["text"]},
                        ]
                    }
                )
    return examples


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixture", type=Path, default=FIXTURE)
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="build the examples and print stats without writing data/")
    args = ap.parse_args()

    messages = parse_whatsapp(args.fixture)
    examples = build_examples(messages)
    holdout = [e for i, e in enumerate(examples) if i % 10 == 9]
    train = [e for i, e in enumerate(examples) if i % 10 != 9]
    if len(examples) < MIN_EXAMPLES_BEFORE_SINGLES:
        raise SystemExit(f"only {len(examples)} examples from {args.fixture}; expected at least {MIN_EXAMPLES_BEFORE_SINGLES}")
    if not args.dry_run:
        write_jsonl(TRAIN_PATH, train)
        write_jsonl(HOLDOUT_PATH, holdout)
    if args.stats or args.dry_run:
        them = [m for m in messages if m["sender"] == "them"]
        asst = [e["messages"][-1]["content"] for e in examples]
        ctx = sum(1 for e in examples if len(e["messages"]) > 3)
        print(f"messages parsed: {len(messages)} (sarah {len(them)}, me {len(messages) - len(them)})")
        print(f"examples: {len(examples)} -> train {len(train)}, holdout {len(holdout)}; with prior context: {ctx}")
        print(f"avg assistant chars: {sum(map(len, asst)) / max(1, len(asst)):.1f}")
        if args.dry_run:
            print("dry run: nothing written")
        else:
            print(f"wrote {TRAIN_PATH.relative_to(REPO_ROOT)} and {HOLDOUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
