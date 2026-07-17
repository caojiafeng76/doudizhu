# AGENTS.md

## Package Manager

This project uses **bun** (lockfile is `bun.lock`). Use `bun install`, `bun dev`, `bun run build`, `bun run lint`, `bun test` — not npm/yarn/pnpm.

## Commands

- `bun dev` — start Vite dev server with HMR (also mounts DeepSeek proxy middleware)
- `bun run build` — runs `tsc -b && vite build` (typecheck **then** build; type errors block the build)
- `bun run lint` — ESLint
- `bun run preview` — preview production build
- `bun test` — run `tests/` with Bun's built-in test runner (`bun:test`)

## Agent Workflow

- Before writing code, check the available MCP/tools and invoke the relevant skills for the task.
- For UI or behavior changes, use the design/brainstorming skill first when applicable, then implement conservatively.
- For bugs, use systematic debugging before changing code; verify the root cause with a minimal reproduction when possible.
- For game logic changes, prefer focused tests under `tests/` with `bun test`, plus `bun run build` and `bun run lint`.
- For frontend layout changes, verify with a dev server/browser check when the needed browser tooling is available.

## Architecture

- Entry: `index.html` → `src/main.tsx` → `src/App.tsx` → `DoudizhuGame`
- Single-page app, no router, no global state library (React `useState` in `DoudizhuGame`)
- Game: 4-player Dou Di Zhu (斗地主), 1 human + 3 AI, Huzhou regional rules
- CSS: `src/game.css` for game styles, `src/index.css` for base reset. Not SCSS/Tailwind.
- Assets: card SVGs in `public/cards/`, icon sprite at `public/icons.svg` (`<use href="/icons.svg#...">`)
- Optional LLM: Vite dev middleware proxies `POST /api/deepseek/decision` via `api/_deepseekProxy.ts` (needs `DEEPSEEK_API_KEY`)

## Game Structure

### Logic (`src/game/` — pure TypeScript, no React)

| File | Role |
|------|------|
| `types.ts` | Card, Combination, GameState, phases, AIDifficulty |
| `deck.ts` | Create/shuffle/deal 108-card double deck |
| `cardLogic.ts` | Identify combinations, `canBeat`, `findValidPlays` |
| `gameEngine.ts` | State machine: bid, play, pass, round end, scores |
| `ai.ts` | Heuristic bid/play by difficulty (easy/medium/hard) |
| `aiStrategy.ts` | Candidate ordering, bomb-preserving filters |
| `deepseekAI.ts` | DeepSeek decision/analysis client + local fallback |
| `selection.ts` | Hand range / multi-select helpers |
| `handHighlights.ts` | Bomb (and related) hand highlights |
| `sounds.ts` | SFX + background music |

### UI (`src/components/`)

- Shell: `DoudizhuGame`
- Seats/table: `PlayerSeat`, `PlayArea`, `Hand`, `Card`
- Flow: `BidPanel`, `GameHeader`, `ScoreBoard`, `ResultModal`
- AI UX: `AIAnalysisPanel`, `aiAnalysisPresentation.ts`

### API (`api/`)

- `_deepseekProxy.ts` — shared DeepSeek handler (env: `DEEPSEEK_API_KEY`, optional `DEEPSEEK_MODEL`, `DEEPSEEK_TIMEOUT_MS`)
- Wired in `vite.config.ts` for local dev; client code in `deepseekAI.ts` falls back to heuristics if unavailable

### Huzhou rules (summary)

- Two decks (108 cards), 25 cards each + 8 bottom cards
- No 三带一 / 四带二; only 三带二
- Airplane: ≥3 consecutive triples + ≥3 consecutive pairs
- Rocket: 2 small jokers + 2 big jokers
- Bid 0–3; landlord takes bottom cards and leads

## TypeScript

Project uses references: `tsconfig.app.json` (src/) and `tsconfig.node.json` (vite.config.ts). Both enable `verbatimModuleSyntax` and `allowImportingTsExtensions` — import paths must use `.ts`/`.tsx` extensions when importing local files.

## Testing

- Runner: Bun built-in (`import { describe, expect, test } from 'bun:test'`)
- Location: `tests/*.test.ts` (rules, turn order, selection, hand highlights, AI strategy/candidates, DeepSeek decision/proxy, AI analysis panel)
- No `test` script in `package.json`; run with `bun test` directly

## CI / Hooks

No CI workflow, no pre-commit hooks, no `.github/` directory.
