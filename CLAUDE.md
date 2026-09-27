# Remnant — agent notes

Bun + TypeScript monorepo (bun workspaces). Web app is Vite + React + TypeScript
(mobile-first, filmed on iPhone Safari). Python 3.12 venv at `.venv` is ONLY for
the River AI fine-tune under `training/`.

- `bun test` runs every test. `bun run typecheck` runs tsc.
- `bun run server` starts the API (owns the GBrain MCP child). `bun run dev` starts Vite.
- Secrets live in `.env` (gitignored): ELEVENLABS_API_KEY, RIVER_API_KEY, optional ANTHROPIC_API_KEY. Never print them.
- Import with explicit `.ts` extensions. No stubs, no unused modules, no inline styles in React.
- Decisions go in `docs/DECISIONS.md`; ethics lines in `docs/ETHICS.md`.
