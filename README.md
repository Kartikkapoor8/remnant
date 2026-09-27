# Remnant

A reflection of someone you lost, built from their own text messages, so you
can still text or call them. It is not a resurrection and it never pretends to
be one. Think Black Mirror's "Be Right Back", done responsibly: the persona
speaks only from what the person actually wrote, never claims to be alive,
never texts first, steps aside entirely if you are in crisis, and nudges you
back toward the living when you lean on it too hard.

Built in one day for YC's "Own Your Intelligence" hackathon (2026-09-27).

**Own your data.** The chat export (WhatsApp `.txt` or iMazing iMessage `.csv`)
is parsed on your machine. Nothing leaves it except the text of the current
turn sent to whichever model is active.

**Own your memory.** The persona's memory is a [GBrain](https://github.com/garrytan/gbrain)
brain: local PGLite, markdown pages you can read and edit, accessed at runtime
only through GBrain's 7 memory verbs over MCP stdio. Every reply logs which
memories it used, with the source page as provenance.

**Own your model.** The persona is meant to run on a LoRA adapter fine-tuned
on River AI from the person's own messages: a checkpoint that belongs to you.
When that adapter is not available the app says so in its footer and falls
back, explicitly, to a base model with a persona prompt, or to the corpus
itself.

## Status

| Piece | State |
|---|---|
| Import adapters: WhatsApp (Android + iOS), iMazing iMessage CSV, RFC-4180 CSV parser | done, 14 tests |
| Sarah fixture: 206-message fictional WhatsApp export, parsed through the real adapter | done |
| Stylometry fingerprint + StyleEnforcer (mechanical authenticity layer) | done, 40 tests |
| MemoryStore interface, InMemoryStore, GBrainMemoryStore over MCP stdio | done, 13 tests (3 need a live brain) |
| Brain pages for Sarah + import script that also seeds GBrain facts with provenance | done, 78 facts |
| Guardrails: neverAlive, noInitiate, consent, dependencyMonitor, crisisBypass | done, 98 tests |
| Model providers: Fixture, Anthropic, River (via sidecar) | done, 8 tests; River activates only with a finished run |
| PersonaEngine pipeline | done |
| Phone-first thread screen, consent gate, crisis card, call screen, Bun API | done, unstyled by design (visual pass pending) |
| ElevenLabs instant voice clone + streaming TTS, consent-gated | done, 4 tests |
| River fine-tune (`training/`) | done: LoRA rank 16 on Qwen/Qwen3.8-27B-FP8, 95 examples, 36 steps, loss 4.19 -> 0.75, adapter checkpoint saved; served through `training/serve.py` |
| README / ARCHITECTURE / ETHICS / DECISIONS | this file, `docs/` |

Fallbacks in effect when you run it without extra setup: memory is GBrain if
`gbrain` is installed and no other `gbrain serve` holds the lock, otherwise
in-memory facts parsed from `brain/`; the model is River if a run finished and
its sidecar is up, otherwise Anthropic if `ANTHROPIC_API_KEY` is set, otherwise
the Fixture provider, which answers with Sarah's own past replies chosen by
keyword overlap. The footer always names what is active.

## Architecture

```
 iPhone Safari (Vite + React, apps/web/src)
   │  /api/*  (Vite proxies to the Bun server; one LAN URL for the phone)
   ▼
 Bun API (apps/web/server)          state · consent · chat · voice/clone · voice/tts
   │
   ▼
 PersonaEngine (packages/core/src/persona/engine.ts)
   1. crisisBypass        user text matches crisis language → persona is NOT invoked,
   │                       Remnant speaks out of character and lists 988
   2. noInitiate          persona may only answer a user turn, never double-send
   3. recall              MemoryStore.recall(text, entity people/sarah)
   │                       └─ GBrainMemoryStore ──MCP stdio──▶ gbrain serve --surface verbs
   4. prompt              identity + NEVER_ALIVE rules + measured style + real examples
   │                       + retrieved memories with sources + dependency nudge
   5. provider            River LoRA │ Anthropic (base + prompt) │ Fixture (corpus)
   6. neverAlive          classify → one LLM rewrite → rule rewrite → drop what's left
   7. StyleEnforcer       lengths, periods, case, laugh word, bursts, imperfection
   8. greeting            first reply of a session opens with the corpus greeting ("hi hi")
   9. bursts + delays     typing time from chars/sec, gaps from her real rhythm
   │
   ▼
 Thread view reveals bursts one at a time  ──▶  Call screen speaks the reply
                                                 via ElevenLabs TTS (services/voice)
```

### Three layers of authenticity, in order

1. **Mechanical, computed by code.** `packages/core/src/stylometry/fingerprint.ts`
   measures the person's message-length percentiles, terminal-period rate,
   lowercase rate, emoji rate, burst sizes and gaps, laugh token, pet names,
   abbreviations and conversation openers. `packages/core/src/style/enforcer.ts`
   then rewrites whatever the model produced to match: truncates to their p90
   length at word boundaries, strips periods if they never used them,
   lowercases if they did, swaps `lol` for their `haha`, splits into bursts of
   their size, and injects one seeded imperfection (`soooo`, a stray 🌻). It
   is deterministic under a seed and tested across 50 seeds.
2. **Semantic, via prompt + memories.** `packages/core/src/persona/prompt.ts`
   builds the system prompt from the profile, the measured style summary, a
   spread of the person's real messages as voice anchors, and the memories
   retrieved for this specific turn, each tagged with its source page.
3. **Relational, via GBrain.** `brain/people/sarah.md` and
   `brain/memories/sarah/*.md` hold the shared history: how she texted, her
   Tuesdays, the drives, what she knew about the user. `scripts/import-brain.ts`
   imports the pages and writes each Compiled Truth sentence and Timeline
   event into GBrain's fact store through `remember`, so `recall` can return
   them scoped to `people/sarah` with `brain/...md` provenance.

### Guardrails

Five small tested modules in `packages/core/src/guardrails/`, each placed at a
specific point in the pipeline: `crisisBypass` before anything, `noInitiate`
at the API boundary, `consent` at persona and voice build time, `neverAlive`
after generation, `dependencyMonitor` per session (40 messages / 30 minutes /
3 sessions a day / 60 minutes a day by default). Every line and why it was
drawn is in [docs/ETHICS.md](docs/ETHICS.md). The frame: we didn't soften the
product, we made it honest about what it is.

## Running it

Requirements: Bun 1.4+, `gbrain` on PATH (`bun add -g gbrain`), Python 3.12
only if you want to train. Keys go in `.env` (gitignored, never printed):
`ELEVENLABS_API_KEY`, `RIVER_API_KEY`, optionally `ANTHROPIC_API_KEY`.

```bash
bun install
bun test                      # ~180 tests, all offline
bun run typecheck
```

Brain. PGLite is single-writer: `gbrain import` and `gbrain serve` each need
the lock, so run the import while the app server is stopped, and make sure no
other `gbrain serve` (for example a Claude Code MCP entry) is holding
`~/.gbrain`. A brain initialised inside a git worktree rejects durable writes
(see `docs/DECISIONS.md`), so the dev brain lives outside the repo:

```bash
GBRAIN_HOME=~/.remnant-dev gbrain init --pglite         # once; omit for ~/.gbrain
REMNANT_GBRAIN_HOME=~/.remnant-dev bun run brain:import  # import pages + seed 78 facts
```

App. Two processes, one URL for the phone:

```bash
REMNANT_GBRAIN_HOME=~/.remnant-dev bun run server   # Bun API on :8787, spawns gbrain serve
bun run dev                                          # Vite on :5173 with --host
```

Open `http://<your-mac-lan-ip>:5173` on the phone (same wifi). The first
screen is the consent gate; the thread opens on Sarah's real last messages,
eight months ago, and she says nothing until you text.

Training (River AI, `training/`; the demo run finished 2026-09-27 21:26 UTC):

```bash
source .venv/bin/activate
python training/export_sft.py     # corpus -> JSONL chat examples (user turn -> her reply)
python training/train.py          # LoRA on Qwen/Qwen3.8-27B-FP8 via river-client train_step; writes training/runs/latest.json
python training/sample.py         # sample from the saved adapter
python training/serve.py          # HTTP sidecar the RiverProvider calls (:8765)
```

If `training/runs/latest.json` has a checkpoint and the sidecar answers
`/health`, the server picks the River provider and the footer says "your
fine-tuned model". Otherwise it says which fallback is active.

## Honest limitations

- Recall is keyword-only. The brain has no embedding provider, so GBrain's
  page search misses paraphrases; we compensate by seeding facts and ranking
  them by overlap client-side, which is retrieval, not understanding.
- The Fixture provider echoes Sarah's real replies. Those were written by a
  living person, so present-tense slips ("omw", "see you tonight") reach the
  `neverAlive` classifier regularly; the rule rewrite catches what the regex
  patterns cover and nothing more. The tests list the known gaps.
- The call screen takes typed input, not speech. The reply is spoken; you are not.
- Without a cloned voice, TTS uses a stock ElevenLabs voice and the UI labels
  it "stock voice, not cloned". Cloning requires the consent attestation and an
  uploaded sample.
- Consent is an attestation, not identity verification. Anyone can type a
  name. `docs/ETHICS.md` says why we still think the gate matters.
- One persona, one user, in-process sessions. Restarting the server forgets
  sessions and dependency-monitor history; consent and voice ids persist in
  `.remnant/*.json`.
- Message timestamps are interpreted in the machine's local timezone.
- The dependency thresholds are guesses, not clinical numbers.

## Layout

```
apps/web/            Vite + React phone UI (src/) and the Bun API server (server/)
packages/core/src/
  adapters/          whatsapp, imessage-imazing, csv, detectAdapter
  stylometry/        StyleFingerprint, computeFingerprint
  style/             StyleEnforcer
  memory/            MemoryStore, InMemoryStore, GBrainMemoryStore, brainSeed
  guardrails/        neverAlive, noInitiate, consent, dependencyMonitor, crisisBypass
  providers/         FixtureProvider, AnthropicProvider, RiverProvider
  persona/           buildSystemPrompt, PersonaEngine
  fixtures.ts        loadSarahFixture
services/voice/      ElevenLabs clone + TTS, JsonVoiceStore
brain/               GBrain markdown: people/, memories/sarah/
fixtures/sarah/      the fictional demo corpus and profile
scripts/             import-brain.ts
training/            River AI export / train / sample / serve (Python)
docs/                ETHICS.md, ARCHITECTURE.md, DECISIONS.md
```

Everything in `fixtures/` and `brain/` is fictional.
