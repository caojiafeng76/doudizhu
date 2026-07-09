# AGENTS.md

## Package Manager

This project uses **bun** (lockfile is `bun.lock`). Use `bun install`, `bun dev`, `bun run build`, `bun run lint` — not npm/yarn/pnpm.

## Commands

- `bun dev` — start Vite dev server with HMR
- `bun run build` — runs `tsc -b && vite build` (typecheck **then** build; type errors block the build)
- `bun run lint` — ESLint
- `bun run preview` — preview production build

## Agent Workflow

- Before writing code, check the available MCP/tools and invoke the relevant skills for the task.
- For UI or behavior changes, use the design/brainstorming skill first when applicable, then implement conservatively.
- For bugs, use systematic debugging before changing code; verify the root cause with a minimal reproduction when possible.
- For game logic changes, prefer focused script checks with `bun --bun` plus `bun run build` and `bun run lint`.
- For frontend layout changes, verify with a dev server/browser check when the needed browser tooling is available.

## Architecture

- Entry: `index.html` → `src/main.tsx` → `src/App.tsx`
- Single-page app, no router, no state management
- Game: 4-player Dou Di Zhu (斗地主), 1 human + 3 AI, Huzhou regional rules
- CSS: `src/game.css` for game styles, `src/index.css` for base reset. Not SCSS/Tailwind.
- SVG sprite sheet at `public/icons.svg`, referenced via `<use href="/icons.svg#...">`

## Game Structure

- `src/game/` — pure logic (no React): types, deck, cardLogic, gameEngine, ai
- `src/components/` — React UI: Card, Hand, BidPanel, PlayArea, PlayerSeat, GameHeader, ScoreBoard, ResultModal, DoudizhuGame
- Huzhou rules: two decks (108 cards), 25 cards each + 8 bottom, no 三带一/四带二, only 三带二, airplane needs ≥3 consecutive triples + ≥3 consecutive pairs
- AI difficulty: easy/medium/hard via `ai.ts` heuristic

## TypeScript

Project uses references: `tsconfig.app.json` (src/) and `tsconfig.node.json` (vite.config.ts). Both enable `verbatimModuleSyntax` and `allowImportingTsExtensions` — import paths must use `.ts`/`.tsx` extensions when importing local files.

## Testing

No test runner or test files exist. There is no `test` script.

## CI / Hooks

No CI workflow, no pre-commit hooks, no `.github/` directory.
