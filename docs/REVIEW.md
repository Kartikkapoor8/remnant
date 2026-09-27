# Self-review, as the reviewing agent

Written at the end of the final pass on 2026-09-27, scoring the repo the way an
automated reviewer opening it cold would. Evidence for each score is a command
or a file, not an adjective. Scores are 1 to 10.

## Pass 1

| Criterion | Score | Evidence |
|---|---|---|
| The code does what the README claims | 8 | `bun test` (198 tests across 19 files: 193 pass, 5 skipped because they need a live brain), `bun run typecheck`, `bun run demo` and `bun run sarah` both verified from a fresh clone in /tmp; `GET /api/health` on the live stack reports `river-finetuned`, `gbrain-stdio`, 66 facts, guardrails 1.2.0. The hosted-brain path (`GBRAIN_MCP_URL`) is implemented and typechecked but was not exercised against a live hosted brain, and the README says so. |
| Sponsor tools are integrated for real | 7 | GBrain: `packages/core/src/memory/gbrain.ts` speaks MCP to `gbrain serve --surface verbs` and uses four verbs; `scripts/sarah.ts` seeds 78 facts with provenance. River: `training/train.py` ran a LoRA on Qwen3.8-27B-FP8 and `training/serve.py` serves it to `RiverProvider`. ElevenLabs: instant clone and streaming TTS behind `checkConsent`. What holds the score down: the River run's evidence (`training/runs/latest.json`, the step log) was gitignored, so a cold reviewer could not see the run happened. |
| Structure and absence of dead code | 7 | Three workspaces with one interface per boundary (`MemoryStore`, `ModelProvider`). Dead weight found: `apps/web/scripts/screens-15pro.ts` and seven `docs/screens/15pro-*.png` from a spacing pass, referenced by nothing. |
| Evidence of engineering judgement | 8 | Explicit, printed fallbacks for every backend; route-level tests with bootstrap knobs; drift tests (`fingerprint.json`, `auditBrain`); `docs/DECISIONS.md` with 27 numbered calls; guardrail gaps found in live River output and closed with tests (decision 13). |
| Commit history looks like a person building today | 8 | 30+ commits between 12:32 and 16:20 local, conventional prefixes, fixes that follow live findings (`fix(guardrails)`, `fix(tests)` after CI ran on Linux). |

**Weakest point:** the River fine-tune, the one piece that makes "own your model"
true, left no trace in the repository. A reviewer would have to take the README's
loss numbers on faith.

**Fix applied:** `training/runs/latest.json`, `training/runs/20260927T212125Z/manifest.json`
and the per-step `log.jsonl` (loss, grad norm, holdout samples) are committed and
un-ignored; nothing in them is a secret (the checkpoint path is only loadable with
the key). The one-off screenshot script and its PNGs are removed in the same pass.

## Pass 2

| Criterion | Score | Change |
|---|---|---|
| The code does what the README claims | 8 | unchanged |
| Sponsor tools are integrated for real | 8 | run evidence is in the tree; the README's numbers are checkable |
| Structure and absence of dead code | 7 | one-off script gone; remaining: `ElevenLabsVoice.listVoices` and `deleteVoice` have no caller and no test |
| Evidence of engineering judgement | 8 | unchanged |
| Commit history looks like a person building today | 8 | unchanged |

**Weakest point:** two unused methods in `services/voice/src/index.ts`. Small, but
the repo's own rule (CLAUDE.md: no unused modules) makes them the most visible
inconsistency left.

**Fix applied:** `listVoices`, `deleteVoice` and the `VoiceInfo` type removed;
voice tests and typecheck still pass.

## Not fixed today, on purpose

- No import screen: the adapters are exercised by tests and by `bun run sarah`, not by a UI upload.
- The hosted brain transport has not been run against a live `gbrain serve --http`.
- Recall is keyword overlap over seeded facts, not semantic search.
