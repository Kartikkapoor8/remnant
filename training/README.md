# training/ — the persona as a model you own

A LoRA adapter for `Qwen/Qwen3.8-27B-FP8` trained on River AI from the Sarah
corpus. The adapter is the user's: it lives at a `river://` checkpoint path that
only this API key can load.

Python 3.12 venv at `../.venv` (`river-client`, `transformers` for the tokenizer).
`RIVER_API_KEY` from the environment or `../.env`. Nothing here prints the key.

| script | what it does |
|---|---|
| `export_sft.py --stats` | fixture WhatsApp export -> `data/sarah.sft.jsonl` (+ `sarah.holdout.jsonl`, every 10th). One example per (user burst -> Sarah burst), with up to two prior exchanges from the same conversation as context, plus single-message pairs. Uses `SYSTEM_PREFIX` from `common.py`. |
| `train.py [--dry-run]` | renders chat examples with River's Qwen3.8 renderer (thinking off, loss on the last assistant turn only), `train_step` batches of 8, lr 1e-4, grad clip 1.0, 3 epochs capped at 40 steps, saves an inference checkpoint, samples 3 holdout prompts, writes `runs/<ts>/log.jsonl` and `runs/latest.json`. |
| `sample.py "text"` | one reply from the adapter (defaults from `runs/latest.json`). |
| `serve.py` | HTTP sidecar on 127.0.0.1:8765 (`GET /health`, `POST /sample`) that the Bun server's `RiverProvider` calls. |

## runs/latest.json

Written only when a run finishes. Exactly:

```json
{ "base_model": "...", "checkpoint": "river://...", "step": 40, "final_loss": 1.23, "finished_at": "ISO", "examples": 90 }
```

`apps/web/server/bootstrap.ts` uses `RiverProvider.detect()`: the provider is
chosen only if this file exists AND `serve.py` answers `/health`. Otherwise the
app falls back to the base model + persona prompt (Anthropic) or, with no key,
to the fixture provider, and the UI footer says which one is running. A
training run that misses the deadline never silently pretends to be the model.

## Run

```sh
cd <repo>
.venv/bin/python training/export_sft.py --stats
.venv/bin/python training/train.py --dry-run
nohup .venv/bin/python training/train.py > training/runs/train.stdout.log 2>&1 &
tail -f training/runs/train.stdout.log
# when latest.json exists:
.venv/bin/python training/serve.py &
bun run server
```
