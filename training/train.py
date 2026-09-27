"""LoRA fine-tune of the Sarah persona on River AI.

    .venv/bin/python training/train.py --dry-run     # tokenize only, no network
    .venv/bin/python training/train.py               # real run, writes runs/latest.json

The run is the user's model: the adapter lives at the river:// checkpoint path
recorded in runs/latest.json, which apps/web reads to pick the RiverProvider.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import traceback
from datetime import datetime, timezone
from pathlib import Path

from common import (
    DEFAULT_BASE_MODEL,
    HOLDOUT_PATH,
    LATEST_PATH,
    RUNS_DIR,
    TRAIN_PATH,
    load_api_key,
    make_renderer,
    read_jsonl,
    strip_thinking,
)


def build_datums(renderer, rows: list[dict]) -> tuple[list[dict], list[int], list[int]]:
    """Returns (datums for train_step, total tokens per example, loss tokens per example).

    Qwen3.8's renderer emits the chunked `model_input` wire form, so token
    counts come from the TrainingExample, not from the dict.
    """
    from river_client.renderers import TrainOnWhat

    datums, tokens, loss_tokens = [], [], []
    for row in rows:
        ex = renderer.build_training_example(row["messages"], train_on=TrainOnWhat.LAST_ASSISTANT)
        datums.append(ex.to_dict())
        tokens.append(len(ex.input_ids))
        loss_tokens.append(ex.num_loss_tokens)
    return datums, tokens, loss_tokens


def batches(items: list[dict], size: int, epoch: int) -> list[list[dict]]:
    # Deterministic per-epoch shuffle so runs are reproducible.
    import random

    order = list(range(len(items)))
    random.Random(1000 + epoch).shuffle(order)
    shuffled = [items[i] for i in order]
    return [shuffled[i : i + size] for i in range(0, len(shuffled), size)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-model", default=DEFAULT_BASE_MODEL)
    ap.add_argument("--epochs", type=int, default=3)
    ap.add_argument("--max-steps", type=int, default=40)
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    rows = read_jsonl(TRAIN_PATH)
    holdout = read_jsonl(HOLDOUT_PATH) if HOLDOUT_PATH.exists() else []
    renderer = make_renderer(args.base_model)
    datums, tokens, loss_tokens = build_datums(renderer, rows)
    print(f"examples={len(datums)} tokens total={sum(tokens)} mean={sum(tokens)/len(tokens):.0f} max={max(tokens)} loss-tokens mean={sum(loss_tokens)/len(loss_tokens):.1f}")
    if args.dry_run:
        print("dry run: not contacting River")
        return 0

    import river_client as river

    run_dir = RUNS_DIR / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "log.jsonl"
    print(f"run dir: {run_dir}")

    def log(record: dict) -> None:
        record["at"] = datetime.now(timezone.utc).isoformat()
        with log_path.open("a") as f:
            f.write(json.dumps(record) + "\n")

    client = river.Client(api_key=load_api_key(), endpoint="api.river.ai")
    attempt = 0
    while True:
        attempt += 1
        try:
            with client.session(project="remnant", persona="sarah", run=run_dir.name) as session:
                log({"event": "session", "session_id": session.session_id, "base_model": args.base_model})
                print(f"session {session.session_id} created")
                model = session.create_model(base_model=args.base_model, lora=river.LoraConfig(rank=args.rank, seed=7))
                log({"event": "model", "model_id": model.model_id})
                step = 0
                last_loss = None
                done = False
                for epoch in range(args.epochs):
                    for batch in batches(datums, args.batch_size, epoch):
                        t0 = time.time()
                        fb, opt = model.train_step(batch, lr=args.lr, loss_fn="cross_entropy", grad_clip_norm=1.0)
                        step += 1
                        last_loss = fb.metrics.get("loss_mean", fb.metrics.get("loss"))
                        rec = {"event": "step", "step": step, "epoch": epoch, "loss_mean": last_loss, "grad_norm": opt.metrics.get("grad_norm"), "examples": len(batch), "secs": round(time.time() - t0, 2)}
                        log(rec)
                        print(f"step {step:3d} epoch {epoch} loss_mean={last_loss:.4f} grad_norm={opt.metrics.get('grad_norm')} ({rec['secs']}s)", flush=True)
                        if step >= args.max_steps:
                            done = True
                            break
                    if done:
                        break
                ckpt = model.save_weights("sarah-lora", mode="inference")
                log({"event": "checkpoint", "path": ckpt.path, "step": ckpt.step})
                print(f"checkpoint: {ckpt.path}")

                stop = renderer.get_stop_strings()
                for row in holdout[:3]:
                    prompt = renderer.build_sample_prompt(row["messages"][:-1]).to_kwargs()["prompt"]
                    out = session.sample(prompt, base_model=args.base_model, checkpoint=ckpt, max_tokens=80, temperature=0.7, stop=stop)
                    text = strip_thinking(out[0][0].text)
                    user = row["messages"][-2]["content"]
                    print(f"\n> {user}\n  sarah(real): {row['messages'][-1]['content']!r}\n  adapter:     {text!r}")
                    log({"event": "sample", "user": user, "real": row["messages"][-1]["content"], "adapter": text})

                manifest = {
                    "base_model": args.base_model,
                    "checkpoint": ckpt.path,
                    "step": step,
                    "final_loss": last_loss,
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                    "examples": len(datums),
                }
                LATEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
                (run_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
                print(f"wrote {LATEST_PATH}")
                return 0
        except river.CapacityError as e:
            log({"event": "capacity", "attempt": attempt, "error": str(e)[:300]})
            print(f"capacity error (attempt {attempt}): {str(e)[:200]}", flush=True)
            if attempt >= 3:
                (run_dir / "error.txt").write_text(f"CapacityError after {attempt} attempts\n{e}\n")
                return 2
            time.sleep(60)
        except Exception as e:  # noqa: BLE001 — record everything, this runs unattended
            (run_dir / "error.txt").write_text(f"{type(e).__name__}: {e}\n\n{traceback.format_exc()}")
            log({"event": "error", "type": type(e).__name__, "error": str(e)[:500]})
            print(f"run failed: {type(e).__name__}: {str(e)[:300]}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
