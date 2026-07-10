# 斗地主 AI 分析面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在真人出牌回合提供一个不会改变游戏状态的 DeepSeek 可解释分析面板，并保持所有建议牌受本地合法候选校验保护。

**Architecture:** 在现有 `deepseekAI.ts` 中复用合法候选和公开局面 payload，新增独立的 `requestAIAnalysis` 只返回展示结果；`DoudizhuGame` 负责请求生命周期和竞态丢弃，`AIAnalysisPanel` 负责纯展示。proxy 扩展为分析 JSON 契约，但叫分和 AI 自动出牌仍走原有行动路径。

**Tech Stack:** React 19、TypeScript 6、Vite、Bun test、ESLint、现有 `src/game.css`。

---

## 文件地图

- Create: `src/components/AIAnalysisPanel.tsx`：只负责 loading、ready、unavailable 三种面板视图。
- Modify: `src/game/deepseekAI.ts`：分析类型、响应清洗、分析请求、候选匹配和现有行动响应的可选解释。
- Modify: `api/_deepseekProxy.ts`：分析模式的 DeepSeek system prompt 和响应 token 上限。
- Modify: `src/components/DoudizhuGame.tsx`：真人回合分析状态、请求 key、取消竞态和面板装配。
- Modify: `src/game.css`：牌桌左上面板样式和窄屏约束。
- Modify: `tests/deepseekDecision.test.ts`：分析请求、候选校验、fallback 和解释清洗测试。
- Modify: `tests/deepseekProxy.test.ts`：分析响应透传和 prompt 约束测试。
- Reference: `docs/superpowers/specs/2026-07-10-ai-analysis-design.md`：已批准的行为契约。

## Task 1: Add analysis contract and safe client request

**Files:**

- Modify: `tests/deepseekDecision.test.ts`
- Modify: `src/game/deepseekAI.ts`

- [ ] **Step 1: Establish the current targeted test baseline**

Run:

```powershell
bun test tests/deepseekDecision.test.ts
```

Expected: the existing DeepSeek helper tests pass before the new behavior is added. If this baseline fails, record the existing failure and do not attribute it to this feature.

- [ ] **Step 2: Write failing tests for analysis responses**

Extend the import in `tests/deepseekDecision.test.ts`:

```ts
import {
  createPlayCandidates,
  pickDeepSeekPlay,
  requestAIAnalysis,
  requestAIDecision,
} from '../src/game/deepseekAI.ts'
```

Add these tests inside the existing `describe('DeepSeek AI decision helpers', ...)` block:

```ts
test('accepts a legal analysis candidate and preserves its explanation', async () => {
  const candidates = createPlayCandidates(hand, null)
  const fetcher = async (_input: RequestInfo | URL, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body)) as {
      mode?: string
      candidates?: Array<{ id: string }>
    }
    expect(payload.mode).toBe('analysis')
    expect(payload.candidates?.map((candidate) => candidate.id)).toEqual(
      candidates.map((candidate) => candidate.id),
    )

    return Response.json({
      action: 'play',
      candidateId: 'play-2',
      analysis: {
        why: '先出小单张，保持手里的对子结构',
        opponent: '少牌方需要被控制接牌机会',
        factors: ['不拆对子', '控制牌效', '保留高牌'],
      },
    })
  }

  const result = await requestAIAnalysis({
    state: baseState,
    playerId: 1,
    mode: 'analysis',
    candidates,
    fallback: [hand[0]],
    fetcher,
  })

  expect(result.status).toBe('ready')
  expect(result.action).toBe('play')
  expect(result.candidate?.id).toBe('play-2')
  expect(result.analysis).toEqual({
    why: '先出小单张，保持手里的对子结构',
    opponent: '少牌方需要被控制接牌机会',
    factors: ['不拆对子', '控制牌效', '保留高牌'],
  })
  expect(result.source).toBe('deepseek')
})

test('keeps a legal candidate when the analysis object is malformed', async () => {
  const candidates = createPlayCandidates(hand, null)
  const fetcher = async () =>
    Response.json({
      action: 'play',
      candidateId: 'play-2',
      analysis: { why: 42, opponent: '有效文本', factors: ['标签'] },
    })

  const result = await requestAIAnalysis({
    state: baseState,
    playerId: 1,
    mode: 'analysis',
    candidates,
    fallback: [hand[0]],
    fetcher,
  })

  expect(result.status).toBe('ready')
  expect(result.candidate?.id).toBe('play-2')
  expect(result.analysis).toBeNull()
})

test('returns unavailable and only exposes a matching local fallback for an invalid candidate', async () => {
  const candidates = createPlayCandidates(hand, null)
  const fetcher = async () =>
    Response.json({ action: 'play', candidateId: 'made-up' })

  const result = await requestAIAnalysis({
    state: baseState,
    playerId: 1,
    mode: 'analysis',
    candidates,
    fallback: [hand[0]],
    fetcher,
  })

  expect(result.status).toBe('unavailable')
  expect(result.source).toBe('fallback')
  expect(result.candidate?.id).toBe('play-1')
  expect(result.analysis).toBeNull()
})
```

- [ ] **Step 3: Run the focused tests and verify the new API is missing**

Run:

```powershell
bun test tests/deepseekDecision.test.ts
```

Expected: FAIL because `requestAIAnalysis` and its result types do not exist yet. The existing four tests should remain green in the output.

- [ ] **Step 4: Add the analysis types and response field**

In `src/game/deepseekAI.ts`, add the following types next to `PlayCandidate` and make the request fetcher type exportable because the new public options type references it:

```ts
export interface AIAnalysis {
  why: string
  opponent: string
  factors: string[]
}

export type AIAnalysisResult = {
  status: 'ready' | 'unavailable'
  action: 'play' | 'pass'
  candidate: PlayCandidate | null
  analysis: AIAnalysis | null
  source: 'deepseek' | 'fallback'
  message?: string
}

export type DecisionFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type AnalysisDecisionOptions = {
  state: GameState
  playerId: number
  mode: 'analysis'
  candidates: PlayCandidate[]
  fallback: Card[] | null
  fetcher?: DecisionFetch
}
```

Keep `BidDecisionOptions` and `PlayDecisionOptions` unchanged except that `DecisionFetch` now refers to the exported alias. Extend the internal response shape:

```ts
type DeepSeekDecisionResponse = {
  action?: unknown
  bid?: unknown
  candidateId?: unknown
  tableTalk?: unknown
  analysis?: unknown
}
```

Add `analysis?: AIAnalysis` to every branch of `AIDecision`, but only include the property at runtime when parsing produces a valid analysis object. This preserves current exact object assertions when DeepSeek does not return analysis.

- [ ] **Step 5: Implement defensive analysis parsing and candidate fallback matching**

Add these helpers below `pickDeepSeekPlay`:

```ts
function parseAIAnalysis(value: unknown): AIAnalysis | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (
    typeof record.why !== 'string' ||
    typeof record.opponent !== 'string' ||
    !Array.isArray(record.factors)
  ) {
    return null
  }

  const why = record.why.trim().slice(0, 120)
  const opponent = record.opponent.trim().slice(0, 120)
  const factors = record.factors
    .filter((factor): factor is string => typeof factor === 'string')
    .map((factor) => factor.trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 3)

  if (!why || !opponent) return null
  return { why, opponent, factors }
}

function findCandidateForCards(
  cards: Card[] | null,
  candidates: PlayCandidate[],
): PlayCandidate | null {
  if (!cards) return null
  const candidateId = `play-${cards
    .map((card) => card.id)
    .sort((a, b) => a - b)
    .join('-')}`
  return candidates.find((candidate) => candidate.id === candidateId) ?? null
}

function unavailableAnalysisResult(
  fallback: Card[] | null,
  candidates: PlayCandidate[],
  message = '分析暂不可用，你可以按自己的判断出牌',
): AIAnalysisResult {
  const candidate = findCandidateForCards(fallback, candidates)
  return {
    status: 'unavailable',
    action: candidate ? 'play' : 'pass',
    candidate,
    analysis: null,
    source: 'fallback',
    message,
  }
}
```

- [ ] **Step 6: Implement `requestAIAnalysis` without any game mutation**

Add a validator and request function. The validator must accept a legal `pass` only when `canPlayerPass` returns true, and must resolve a `play` only through the provided candidate list:

```ts
function validateAIAnalysis(
  data: DeepSeekDecisionResponse,
  options: AnalysisDecisionOptions,
): AIAnalysisResult | null {
  const analysis = parseAIAnalysis(data.analysis)

  if (
    data.action === 'pass' &&
    canPlayerPass(options.state, options.playerId)
  ) {
    return {
      status: 'ready',
      action: 'pass',
      candidate: null,
      analysis,
      source: 'deepseek',
    }
  }

  if (data.action !== 'play' || typeof data.candidateId !== 'string')
    return null
  const candidate = options.candidates.find(
    (item) => item.id === data.candidateId,
  )
  if (!candidate) return null

  return {
    status: 'ready',
    action: 'play',
    candidate,
    analysis,
    source: 'deepseek',
  }
}

export async function requestAIAnalysis(
  options: AnalysisDecisionOptions,
): Promise<AIAnalysisResult> {
  const fallback = () =>
    unavailableAnalysisResult(options.fallback, options.candidates)

  try {
    const response = await (options.fetcher ?? fetch)(
      '/api/deepseek/decision',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createDecisionPayload(options)),
      },
    )

    if (!response.ok) return fallback()
    const data = (await response.json()) as DeepSeekDecisionResponse
    return validateAIAnalysis(data, options) ?? fallback()
  } catch {
    return fallback()
  }
}
```

Include `AnalysisDecisionOptions` in the payload union accepted by `createDecisionPayload`. Emit `candidates` when `mode` is either `'play'` or `'analysis'`; emit `legalBids` only for `'bid'`.

- [ ] **Step 7: Preserve optional analysis on existing AI actions**

In `validateDeepSeekDecision`, parse once with `parseAIAnalysis(data.analysis)`. For each valid bid, play, or pass result, spread `{ analysis }` only when the parsed value is non-null. Do not add `analysis: undefined` to returned objects, so the existing exact bid assertion remains unchanged.

- [ ] **Step 8: Run the focused tests and typecheck the changed domain file**

Run:

```powershell
bun test tests/deepseekDecision.test.ts
bun run build
```

Expected: all DeepSeek decision tests pass, and TypeScript reports no errors in `src/game/deepseekAI.ts` or its imports. Fix only domain-contract errors before moving to the proxy task.

## Task 2: Extend the DeepSeek proxy contract

**Files:**

- Modify: `tests/deepseekProxy.test.ts`
- Modify: `api/_deepseekProxy.ts`

- [ ] **Step 1: Write the failing proxy analysis test**

Add a second request fixture and test that captures the outgoing body:

```ts
test('returns analysis JSON and sends the analysis constraints to DeepSeek', async () => {
  const calls: Array<{ body: Record<string, unknown> }> = []
  const handler = createDeepSeekDecisionHandler({
    env: { DEEPSEEK_API_KEY: 'test-key' },
    fetcher: async (_input, init) => {
      calls.push({
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      })
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: 'play',
                candidateId: 'play-2',
                analysis: {
                  why: '保持牌效',
                  opponent: '注意少牌方',
                  factors: ['不拆牌'],
                },
              }),
            },
          },
        ],
      })
    },
  })

  const response = await handler(
    new Request('https://example.com/api/deepseek/decision', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'analysis',
        candidates: [{ id: 'play-2' }],
      }),
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({
    action: 'play',
    candidateId: 'play-2',
    analysis: {
      why: '保持牌效',
      opponent: '注意少牌方',
      factors: ['不拆牌'],
    },
  })

  const messages = calls[0].body.messages as Array<{
    role: string
    content: string
  }>
  expect(messages[0].content).toContain('mode: analysis')
  expect(messages[0].content).toContain('不得声称看到了对手的具体手牌')
  expect(messages[0].content).toContain('candidateId')
})
```

- [ ] **Step 2: Run the focused proxy tests and verify the prompt assertion fails**

Run:

```powershell
bun test tests/deepseekProxy.test.ts
```

Expected: existing proxy tests pass, and the new test fails because the current system prompt has no analysis-mode constraints.

- [ ] **Step 3: Extend the system prompt and response budget**

In `api/_deepseekProxy.ts`, append explicit analysis rules after the existing play format line:

```ts
'分析格式：{"action":"play","candidateId":"候选id","analysis":{"why":"不超过120字","opponent":"不超过120字","factors":["短标签"]}} 或 {"action":"pass","analysis":{"why":"不超过120字","opponent":"不超过120字","factors":["短标签"]}}。',
'mode 为 analysis 时只输出动作、候选和 analysis，不输出 Markdown 或思考过程。',
'只能根据公开信息推断对手，不得声称看到了对手的具体手牌。',
'analysis.factors 最多输出 3 个短标签。',
```

Raise `max_tokens` from `160` to `260` so the three explanation fields fit without changing the existing timeout or response format. Keep the bid and play short-output lines unchanged for compatibility.

- [ ] **Step 4: Run proxy tests and the full current test suite**

Run:

```powershell
bun test tests/deepseekProxy.test.ts tests/deepseekDecision.test.ts
```

Expected: all proxy and decision tests pass, including the existing exact `tableTalk` passthrough and bid assertions.

## Task 3: Create the presentational analysis panel

**Files:**

- Create: `src/components/AIAnalysisPanel.tsx`

- [ ] **Step 1: Define the panel prop contract and render branches**

Create the component with no game-state access and no side effects:

```tsx
import type { AIAnalysisResult, PlayCandidate } from '../game/deepseekAI.ts'

interface AIAnalysisPanelProps {
  status: 'loading' | 'ready' | 'unavailable'
  result: AIAnalysisResult | null
}

const COMBINATION_LABELS: Record<PlayCandidate['combination']['type'], string> =
  {
    single: '单张',
    pair: '对子',
    triple: '三张',
    triple_pair: '三带二',
    straight: '顺子',
    consecutive_pairs: '连对',
    airplane: '飞机',
    bomb: '炸弹',
    rocket: '火箭',
  }

export function AIAnalysisPanel({ status, result }: AIAnalysisPanelProps) {
  const candidate = result?.candidate ?? null
  const analysis = result?.analysis ?? null
  const recommendation = candidate
    ? `${candidate.labels.join(' ')} / ${COMBINATION_LABELS[candidate.combination.type]}`
    : '不出'

  return (
    <aside
      className={`ai-analysis-panel ai-analysis-panel-${status}`}
      role="status"
      aria-live="polite"
    >
      <div className="ai-analysis-heading">
        <span className="ai-analysis-mark" aria-hidden="true" />
        <h2>AI 分析</h2>
      </div>

      {status === 'loading' && (
        <div className="ai-analysis-loading">
          <span>正在分析你的手牌…</span>
          <span className="thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      )}

      {status !== 'loading' && (
        <>
          <div className="ai-analysis-recommendation">
            <span className="ai-analysis-label">建议</span>
            <strong>
              {status === 'unavailable' && !candidate
                ? '暂不可用'
                : recommendation}
            </strong>
          </div>

          {status === 'unavailable' && (
            <p className="ai-analysis-message">
              {result?.message ?? '分析暂不可用，你可以按自己的判断出牌'}
            </p>
          )}

          {status === 'ready' && (
            <>
              <section className="ai-analysis-section">
                <h3>为什么这样出</h3>
                <p>{analysis?.why ?? '暂无详细分析'}</p>
              </section>
              <section className="ai-analysis-section">
                <h3>对手考虑</h3>
                <p>{analysis?.opponent ?? '暂无详细分析'}</p>
              </section>
              <section className="ai-analysis-section">
                <h3>判断依据</h3>
                {analysis?.factors.length ? (
                  <div className="ai-analysis-factors">
                    {analysis.factors.map((factor) => (
                      <span key={factor}>{factor}</span>
                    ))}
                  </div>
                ) : (
                  <p>暂无详细分析</p>
                )}
              </section>
            </>
          )}

          {status === 'unavailable' && candidate && (
            <p className="ai-analysis-local">本地建议：{recommendation}</p>
          )}
        </>
      )}
    </aside>
  )
}
```

Use the exact existing `PlayCandidate` combination keys. The component must not call `playCards`, mutate selection, or infer cards from explanation strings.

- [ ] **Step 2: Run the build to catch component contract and JSX errors**

Run:

```powershell
bun run build
```

Expected: the new component compiles even before it is mounted. No test runner or component-test dependency is added for this presentational-only unit.

## Task 4: Integrate analysis into the human-turn lifecycle

**Files:**

- Modify: `src/components/DoudizhuGame.tsx`

- [ ] **Step 1: Add analysis imports and local view state**

Update the DeepSeek import and add the panel import:

```tsx
import {
  createPlayCandidates,
  requestAIAnalysis,
  requestAIDecision,
} from '../game/deepseekAI.ts'
import type { AIAnalysisResult } from '../game/deepseekAI.ts'
import { AIAnalysisPanel } from './AIAnalysisPanel'
```

Add this type above `DoudizhuGame`:

```tsx
type AIAnalysisViewState =
  | { status: 'idle' | 'loading'; result: null }
  | { status: 'ready' | 'unavailable'; result: AIAnalysisResult }
```

Add state and a request generation ref alongside the existing notice state. Define `clearAIAnalysis` immediately after these declarations and before `startGame`, because `startGame` and the action handlers will include it in their dependency arrays:

```tsx
const [aiAnalysisState, setAIAnalysisState] = useState<AIAnalysisViewState>({
  status: 'idle',
  result: null,
})
const analysisRequestIdRef = useRef(0)

const clearAIAnalysis = useCallback(() => {
  analysisRequestIdRef.current += 1
  setAIAnalysisState({ status: 'idle', result: null })
}, [])
```

- [ ] **Step 2: Add a deterministic局面 key and clear helper**

After `isHumanTurn` is computed, derive a key that excludes `selectedCardIds`:

```tsx
const analysisKey = isHumanTurn
  ? [
      gameState.roundNumber,
      humanPlayer.hand.map((card) => card.id).join(','),
      gameState.playingState.lastPlayerIndex,
      gameState.playingState.lastPlay?.cards.map((card) => card.id).join(',') ??
        'none',
      gameState.playingState.playHistory.length,
    ].join('|')
  : null
```

Call `clearAIAnalysis()` in `startGame`, `handleNewRound`, successful `attemptPlayCards`, and successful `handlePass`. Keep the existing selection and notice updates intact.

Update the dependency arrays of those callbacks to include `clearAIAnalysis`; keep `startGame` declared after the helper so the helper is initialized before its dependency array is evaluated.

- [ ] **Step 3: Add the cancellable analysis effect**

Place this effect near the existing AI-turn effect:

```tsx
useEffect(() => {
  if (!hasStarted || !isHumanTurn || !analysisKey) {
    setAIAnalysisState({ status: 'idle', result: null })
    return
  }

  const requestId = ++analysisRequestIdRef.current
  let cancelled = false
  const candidates = createPlayCandidates(
    humanPlayer.hand,
    gameState.playingState.lastPlay,
  )
  const fallback = aiPlayTurn(
    humanPlayer.hand,
    gameState.playingState.lastPlay,
    humanPlayer.isLandlord,
    gameState.aiDifficulty,
  )

  setAIAnalysisState({ status: 'loading', result: null })

  void requestAIAnalysis({
    state: gameState,
    playerId: 0,
    mode: 'analysis',
    candidates,
    fallback,
  }).then((result) => {
    if (cancelled || analysisRequestIdRef.current !== requestId) return
    setAIAnalysisState({ status: result.status, result })
  })

  return () => {
    cancelled = true
    analysisRequestIdRef.current += 1
  }
}, [analysisKey, gameState, hasStarted, humanPlayer, isHumanTurn])
```

The effect may use the current `gameState` snapshot because the key changes whenever the relevant hand, last play, round, player, or history changes. It must never call `playCards`, `passTurn`, `setSelectedCardIds`, or any sound effect.

- [ ] **Step 4: Mount the panel only during the human playing turn**

Insert the panel inside `.table-container`, before the player seats:

```tsx
{
  isHumanTurn && aiAnalysisState.status !== 'idle' && (
    <AIAnalysisPanel
      status={aiAnalysisState.status}
      result={aiAnalysisState.result}
    />
  )
}
```

The `isHumanTurn` guard hides stale content immediately on a turn change; the effect cleanup prevents a late network response from restoring it.

- [ ] **Step 5: Run focused tests, lint, and build**

Run:

```powershell
bun test tests/deepseekDecision.test.ts tests/deepseekProxy.test.ts
bun run lint
bun run build
```

Expected: all targeted tests pass, ESLint reports no hook dependency or JSX issues, and the full TypeScript/Vite build succeeds.

## Task 5: Style the panel without disturbing the table

**Files:**

- Modify: `src/game.css`

- [ ] **Step 1: Add desktop panel styles next to the table container styles**

Add styles for the new class names:

```css
.ai-analysis-panel {
  position: absolute;
  top: 22px;
  left: 24px;
  width: min(286px, calc(100% - 48px));
  max-height: min(250px, calc(100% - 250px));
  overflow-y: auto;
  padding: 14px 16px;
  background: linear-gradient(
    145deg,
    rgba(31, 24, 14, 0.88),
    rgba(12, 25, 18, 0.9)
  );
  border: 1px solid rgba(212, 168, 67, 0.3);
  border-left: 3px solid var(--color-gold);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(8px);
  pointer-events: none;
  z-index: 2;
}

.ai-analysis-heading,
.ai-analysis-recommendation,
.ai-analysis-loading {
  display: flex;
  align-items: center;
}

.ai-analysis-heading {
  gap: 8px;
  margin-bottom: 12px;
}

.ai-analysis-heading h2 {
  margin: 0;
  color: var(--color-gold);
  font-family: var(--font-display);
  font-size: 14px;
}

.ai-analysis-mark {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-gold);
  box-shadow: 0 0 10px rgba(240, 208, 112, 0.65);
}

.ai-analysis-recommendation {
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(212, 168, 67, 0.16);
}

.ai-analysis-label,
.ai-analysis-section h3 {
  color: var(--color-text-dim);
  font-size: 11px;
}

.ai-analysis-recommendation strong {
  color: var(--color-gold-light);
  font-size: 15px;
  text-align: right;
}

.ai-analysis-section {
  margin-top: 10px;
}

.ai-analysis-section h3 {
  margin: 0 0 4px;
  font-weight: 700;
}

.ai-analysis-section p,
.ai-analysis-message,
.ai-analysis-local {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.ai-analysis-message,
.ai-analysis-local {
  margin-top: 10px;
}

.ai-analysis-factors {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ai-analysis-factors span {
  padding: 3px 6px;
  color: var(--color-gold-light);
  background: rgba(212, 168, 67, 0.12);
  border: 1px solid rgba(212, 168, 67, 0.2);
  border-radius: 3px;
  font-size: 11px;
}

.ai-analysis-loading {
  justify-content: space-between;
  gap: 10px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.ai-analysis-panel .thinking-dots {
  position: static;
}
```

- [ ] **Step 2: Add narrow-screen constraints and reduced-motion compatibility**

Add a responsive block near the existing responsive/reduced-motion rules:

```css
@media (max-width: 760px) {
  .ai-analysis-panel {
    top: 12px;
    left: 12px;
    width: min(236px, calc(100% - 24px));
    max-height: min(190px, calc(100% - 230px));
    padding: 11px 12px;
  }

  .ai-analysis-heading {
    margin-bottom: 8px;
  }

  .ai-analysis-heading h2 {
    font-size: 13px;
  }

  .ai-analysis-recommendation strong {
    font-size: 13px;
  }

  .ai-analysis-section {
    margin-top: 8px;
  }
}
```

The panel remains non-interactive and text wraps inside its own width. Do not add a new gradient palette or alter existing seat/hand coordinates.

- [ ] **Step 3: Run lint and build after CSS integration**

Run:

```powershell
bun run lint
bun run build
```

Expected: both commands pass. CSS warnings, if any, must be limited to existing project tooling; fix any warnings caused by the new selectors before browser validation.

## Task 6: Run end-to-end verification

**Files:**

- Verify: `src/game/deepseekAI.ts`
- Verify: `api/_deepseekProxy.ts`
- Verify: `src/components/DoudizhuGame.tsx`
- Verify: `src/components/AIAnalysisPanel.tsx`
- Verify: `src/game.css`
- Verify: `tests/deepseekDecision.test.ts`
- Verify: `tests/deepseekProxy.test.ts`

- [ ] **Step 1: Run all automated checks**

Run:

```powershell
bun test
bun run lint
bun run build
```

Expected: all Bun tests pass, ESLint exits with code 0, and `tsc -b && vite build` exits with code 0.

- [ ] **Step 2: Start the development server**

Run:

```powershell
bun dev
```

Expected: Vite starts without a port collision. Use the printed local URL; if the default port is occupied, use the alternate URL Vite prints.

- [ ] **Step 3: Verify the human-turn loading and ready states**

Start a round, wait until the human playing turn, and verify:

- the panel is in the upper-left table area;
- loading appears once for the current局面;
- a valid response shows a candidate recommendation, reason, opponent consideration, and no more than 3 factor tags;
- selecting cards does not trigger another request or clear the panel;
- the panel does not cover the hand or play controls at the tested viewport.

- [ ] **Step 4: Verify failure and race behavior**

With no configured API key or a forced failed proxy response, verify:

- the panel shows the unavailable message;
- a matching local candidate may be labeled as a local suggestion;
- manual `出牌` and `不出` still work;
- after a human action, the old panel disappears immediately;
- a delayed response from the previous turn cannot restore old content.

- [ ] **Step 5: Verify phase and responsive behavior**

Verify that the panel is hidden during:

- the start screen;
- bidding;
- AI turns;
- round-end modal.

Resize to a narrow phone-like viewport and confirm text wraps within the panel, factor tags stay inside the panel, and no visible overlap occurs with the hand, controls, or seats.

## Completion Checklist

- [ ] `AIAnalysis` and `AIAnalysisResult` are exported with the exact fields in the approved spec.
- [ ] Analysis uses a dedicated `mode: 'analysis'` request and never executes a game action.
- [ ] Every displayed play recommendation is resolved from local `PlayCandidate` data.
- [ ] Invalid model analysis is discarded without invalidating a legal action.
- [ ] Stale responses are ignored after a turn or round change.
- [ ] Existing bid, AI play, pass, and `tableTalk` behavior remains unchanged.
- [ ] `bun test`, `bun run lint`, and `bun run build` pass.
- [ ] Desktop and narrow-screen browser checks pass.
