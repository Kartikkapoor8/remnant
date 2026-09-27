# Remnant

A reflection of someone you lost, built from their own messages, so you can
still text or call them. Not a resurrection. A reflection, and honest about it.

Built for YC's "Own Your Intelligence" hackathon (2026-09-27): own your data
(the message export never leaves your machine), own your memory (GBrain, local
PGLite), own your model (a LoRA fine-tune on River AI that belongs to you).

## Status

Work in progress on hackathon day. See `docs/DECISIONS.md` for the running log
and `docs/ETHICS.md` for every line we drew.

## Layout

- `apps/web` — Vite + React phone-first UI and the Bun API server
- `packages/core` — adapters, stylometry, StyleEnforcer, memory, guardrails, persona engine
- `services/voice` — ElevenLabs voice cloning + TTS (consent-gated)
- `training` — River AI export / train / sample scripts (Python 3.12, `.venv`)
- `brain` — GBrain markdown pages for the fixture persona
- `fixtures/sarah` — the demo corpus (fictional)
- `docs` — ethics, architecture, decisions
