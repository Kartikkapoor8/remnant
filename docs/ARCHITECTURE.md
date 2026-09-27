# Architecture

What we built, why it is shaped this way, and what we traded away. The
chronological log of individual calls is in `DECISIONS.md`; the ethical lines
are in `ETHICS.md`. This document is the map.

## Monorepo

Bun workspaces, three packages: `packages/core` (everything that is not a UI
or a vendor call), `services/voice` (ElevenLabs), `apps/web` (React UI plus the
Bun API server). Core has no React and no vendor SDK except the Anthropic and
MCP clients, so every authenticity and guardrail decision is testable with
`bun test` offline. That was the point: an automated reviewer can run ~180
tests without keys, and the demo can run without a network.

## Vite in front, Bun API behind

The brief asked for Vite + React. The catch is the phone: the app is filmed on
an iPhone, so both the page and the API must be reachable on one LAN URL. Vite
runs with `--host` and proxies `/api` to the Bun server on `:8787`, so the
phone only ever talks to `:5173`. The Bun server is a separate process because
it owns a child process (`gbrain serve`) and holds in-process session state;
mixing that into a Vite dev server would have coupled our memory lifecycle to
the bundler's restarts.

## MemoryStore: one interface, two implementations

`packages/core/src/memory/store.ts` defines `recall`, `remember`, `entity`,
`forget`, `close`. `InMemoryStore` is the deterministic test double.
`GBrainMemoryStore` spawns `gbrain serve --surface verbs` and speaks MCP over
stdio with the official `@modelcontextprotocol/sdk` client. We use four of the
seven verbs at runtime and deliberately skip `synthesize`: it runs an LLM
inside gbrain, and the persona prompt already reasons over retrieved facts.

Recall ranks client-side. The brain has no embedding provider (keyless), so
gbrain's page-search arm is keyword-only and missed obvious queries in
testing ("hair appointment" returned nothing while the page contained both
words). The facts arm, filtered by entity, is reliable. So the import script
writes every Compiled Truth sentence and Timeline event into the fact store
via `remember`, with the page path as provenance, and `recall` fetches all
facts for `people/sarah`, scores them by token overlap with the user's
message, adds any page hits, and pads to a small floor of background facts
so the persona is never ungrounded. This is honest retrieval with visible
provenance, not semantic search; adding an embedding provider to the brain
would improve the page arm without changing the interface.

## StyleEnforcer is code, not prompt

Asking a model to "text like Sarah" produces a paragraph that is 30% too
long, ends every sentence with a period, and capitalises "I". Those are
measurable properties of a corpus, so we measure them
(`stylometry/fingerprint.ts`) and enforce them after generation
(`style/enforcer.ts`): truncate to the person's p90 length at a word
boundary, strip terminal periods if they never used them, lowercase if they
did, swap the laugh token, split into bursts drawn from their burst-size
distribution, inject one seeded imperfection. The pipeline is deterministic
under a seed and tested across 50 seeds for invariants. The trade-off is
bluntness: clause-boundary cuts occasionally drop the end of a thought, and
the enforcer cannot invent a signature phrase the model did not produce. We
accepted that because a mechanically wrong reply breaks the illusion faster
than a semantically thin one.

## Providers and the explicit-fallback rule

`ModelProvider` is a one-method interface. Order in `bootstrap.ts`:
`RiverProvider` if `training/runs/latest.json` has a checkpoint AND the
sidecar answers `/health`; else `AnthropicProvider` if credentials exist;
else `FixtureProvider`. The rule is that a fallback is never silent:
`/api/state` carries a `provider.note` and the footer prints it. The
FixtureProvider deserves a word: it does not generate. It builds (user
message, her reply burst) pairs from the corpus and returns the burst whose
prompt best overlaps the incoming text, hashed deterministically when nothing
overlaps. That makes the demo runnable with zero keys and makes engine tests
exact, at the cost of replies that were written for a different moment.

## River through a sidecar

River's client is Python over gRPC, and sampling from a saved LoRA requires a
live River session. A TypeScript port was out of scope, and spawning a Python
process per request would pay for session creation every turn. So
`training/serve.py` is a small HTTP sidecar holding one River session and
rendering chat turns through River's Qwen3.8 renderer; the TypeScript
`RiverProvider` posts `{system, turns}` to it. Two processes to run instead
of one, in exchange for using the vendor's own tokenizer and chat template
rather than re-implementing them.

## Where each guardrail sits

Placement is the design. `crisisBypass` runs on the raw user text before
memory or model are touched, because a crisis is not a persona event.
`noInitiate` runs at the engine boundary, before generation. `consent` runs
in the server before `engine.reply` and again before any voice call; the
voice module has no consent logic on purpose, so it cannot be bypassed by a
caller forgetting a flag. `neverAlive` runs after generation: the rules are
also in the prompt, but the classifier is the backstop, and a final filter
drops any burst that still fails after the rewrite. `dependencyMonitor` sits
across sessions and only changes the prompt (or, with the Fixture provider,
appends a deterministic line).

## Consent as a JSON file

`JsonFileConsentStore` writes to `.remnant/consent.json`. It is one record
for the demo and it must survive a restart. A database would have added a
dependency for no gain; a file is the honest minimum. Voice clone ids live
next to it in `.remnant/voice.json` with the consent id they were granted
under.

## GBrain lock realities

PGLite is single-connection. `gbrain serve` refuses to start if another live
serve holds the lock, and `gbrain import` needs the lock too. Consequences:
the import script runs while the app server is down; a Claude Code MCP entry
for gbrain must not be running against the same brain; the server sets
`GBRAIN_HOME` from `REMNANT_GBRAIN_HOME` so the app can own a brain of its
own. We also learned that a brain initialised inside a git worktree accepts
imports but rejects every `remember` with a storage error, so the dev brain
lives at `~/.remnant-dev`. If the child dies with a lock error, the server
logs the exact fix and falls back to in-memory facts parsed from `brain/`.

## Remnant as a QM agent

QM (yc-software/qm, cloned at `~/hack/qm` for reference, not integrated) is a
multiplayer agent harness for work: every person and room gets a scoped
memory, sandbox and tool surface, and the harness is model- and
runtime-agnostic. Remnant's PersonaEngine could plausibly run as a QM agent
in a single person's private scope, with that scope's memory provider routed
to the GBrain brain and the persona reached from a Slack DM. The fit is
partial. QM is built for collaboration and shared rooms; Remnant is intimate,
single-user, and must never appear in a channel or be addressed by anyone but
the person who built it. Its guardrails (no initiation, crisis bypass,
consent) would have to be enforced by the harness's policy layer, not only
inside the agent, and QM's approval postures were designed around command
safety rather than grief. We note the path; we did not walk it.

## What we would change with another day

An embedding provider for the brain. Speech input on the call screen.
Sessions and dependency history persisted to the brain instead of process
memory. A second persona to prove the import path end to end on a real
export.
