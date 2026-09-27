# Guardrails

Five small, tested modules. Each one is a line we drew on purpose; the reasoning is in `docs/ETHICS.md`.

**neverAlive** (`neverAlive.ts`) — post-generation. Every model reply is run through `classifyNeverAlive`, which flags sentences where the persona claims presence ("i'm here"), reports a current activity or feeling ("im driving", "i miss you"), or makes a plan ("see you tonight"). `rewriteNeverAlive` tries one LLM rewrite if a rewriter is available, re-classifies, and otherwise falls back to the deterministic `ruleRewrite` (miss → loved, everything else removed, honest fallback line if nothing survives). `NEVER_ALIVE_SYSTEM_RULES` is also embedded in the persona prompt so the model rarely gets this far.

**noInitiate** (`noInitiate.ts`) — at the API boundary. `canPersonaSpeak` is checked before any generation: the persona never speaks in a session with zero user messages, and never double-sends. A burst is one persona turn.

**consent** (`consent.ts`) — at persona and voice build time. `checkConsent` requires a `deceased-attestation` from the user for a deceased subject, and a `living-consent` granted by the subject themself for a living one. Scope is per purpose: `persona` and `voice-clone` are separate grants. Stores: in-memory for tests, a JSON file for the app.

**dependencyMonitor** (`dependencyMonitor.ts`) — per session. Records user/persona turns, assesses message count, session length, sessions per day and minutes per day against `DEFAULT_THRESHOLDS`, and returns a prompt directive that makes the persona, in character, point the user back toward a real person. `fallbackNudgeLine` covers the no-model path.

**crisisBypass** (`crisisBypass.ts`) — before anything else. `detectCrisis` runs on the raw user message before memory retrieval and before the model. On a hit the persona is not invoked at all; `crisisResponse` speaks as Remnant, out of character, and lists 988 and other resources.
