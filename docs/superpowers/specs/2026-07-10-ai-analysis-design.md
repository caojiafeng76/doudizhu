# 斗地主 AI 分析面板设计

- 日期：2026-07-10
- 状态：设计已获用户确认，待实现
- 范围：湖州四人两副牌斗地主的真人出牌回合

## 1. 目标

在真人玩家可以出牌时，在牌桌左上角显示一块简洁的 AI 分析面板，告诉玩家：

1. 建议出哪一组合法牌，或建议不出；
2. 为什么选择这个动作；
3. 对手当前需要考虑什么；
4. 这次判断依赖了哪些公开因素。

DeepSeek 负责从本地生成的合法候选中选择并生成解释。规则引擎负责生成候选和最终合法性边界。分析只提供建议，不会自动选牌、改变选中牌或调用 `playCards`。

## 2. 非目标

- 不在叫分阶段显示完整出牌分析；
- 不让 DeepSeek 直接生成牌面或绕过 `candidateId` 校验；
- 不展示或推断对手的具体隐藏手牌；
- 不因为分析请求失败而阻塞真人手动出牌；
- 不引入新的状态管理库、路由或 AI 服务提供商；
- 不把分析请求复用为会直接执行 AI 行动的回调。

## 3. 当前代码约束

- `src/game/deepseekAI.ts` 已经通过 `createPlayCandidates` 生成合法候选，并使用稳定的 `play-...` ID。
- 当前 `requestAIDecision` 服务于叫分和 AI 自动出牌；AI 自动出牌完成后由 `DoudizhuGame` 调用 `playCards` 或 `passTurn`。
- `src/components/DoudizhuGame.tsx` 持有 `gameState`，并以 effect 驱动 AI 回合。
- `.table-container` 是相对定位牌桌，左侧座位约在 `left: 26px`，右上已有 `ScoreBoard`。
- 样式位于 `src/game.css`，项目不使用 Tailwind 或 SCSS。

## 4. 用户界面

### 4.1 显示位置

新增 `src/components/AIAnalysisPanel.tsx`，由 `DoudizhuGame` 在 `.table-container` 内渲染。桌面端固定在牌桌左上区域，不改变现有座位、中央牌区、手牌和控制栏的布局流。

建议的布局约束：

- 使用绝对定位，锚定牌桌左上角；
- 桌面端宽度约为 250 至 290px，不能覆盖右上比分板；
- 使用现有深绿色、深木色、金色边框和半透明背景；
- 使用一条金色左边线表示当前建议，不新增紫色或独立主题色；
- 面板层级低于主要操作控件和手牌，不能拦截牌面点击；
- 窄屏时使用 `width: min(...)` 和内边距收缩，长文本换行，不盖住底部手牌和控制栏。

### 4.2 完成态内容

面板标题为“AI 分析”，内容按以下顺序显示：

- **建议**：显示“出牌”或“不出”；出牌时使用候选的 `labels` 和牌型摘要，例如“7，单张”。
- **为什么这样出**：显示 `analysis.why`。
- **对手考虑**：显示 `analysis.opponent`。
- **判断依据**：将 `analysis.factors` 渲染为最多 3 个短标签。

建议牌来自已验证的 `PlayCandidate`，不根据模型返回的自然语言重新解析牌面。

### 4.3 状态

- `idle`：不在真人出牌回合时不渲染面板。
- `loading`：显示“正在分析你的手牌…”和现有风格的点状等待动画；不保留上一回合内容。
- `ready`：显示建议和解释。若响应有合法建议但缺少有效分析对象，显示建议，并在解释区域显示“暂无详细分析”。
- `unavailable`：显示“分析暂不可用，你可以按自己的判断出牌”。如果本地策略能精确匹配到一个合法候选，可额外显示“本地建议：……”；该建议不得伪装成 DeepSeek 的解释。

面板使用 `role="status"` 或 `aria-live="polite"`，不能用强打断式的 `assertive` 通知。面板内容变化不应清除或改变 `selectedCardIds`。

## 5. 数据模型与 API 契约

### 5.1 分析对象

在 `src/game/deepseekAI.ts` 中新增：

```ts
export interface AIAnalysis {
  why: string
  opponent: string
  factors: string[]
}
```

客户端对模型返回值进行防御性清洗：

- `why` 和 `opponent` 必须是非空字符串，去除首尾空白，最多保留 120 个字符；
- `factors` 必须是数组，过滤非字符串和空字符串，最多保留 3 项，每项最多 24 个字符；
- 任一必需字段类型不符合要求时，整个 `analysis` 视为缺失，而不是让部分不可信内容进入 UI；
- 分析缺失只影响解释显示，不影响已经通过候选校验的动作。

### 5.2 DeepSeek 返回格式

分析请求只接受以下 JSON 形状：

```json
{
  "action": "play",
  "candidateId": "play-1-4",
  "analysis": {
    "why": "先出小单张，保持手里的对子结构",
    "opponent": "右侧玩家只剩少量手牌，需要避免给它连续接牌机会",
    "factors": ["不拆对子", "控制牌效", "保留高牌"]
  }
}
```

当建议不出时：

```json
{
  "action": "pass",
  "analysis": {
    "why": "当前没有必要拆出高价值牌去接",
    "opponent": "上家牌力较高，保留控制牌更重要",
    "factors": ["保留炸弹", "避免拆牌"]
  }
}
```

规则：

- `action` 只能是 `play` 或 `pass`；
- `action` 为 `play` 时必须有字符串 `candidateId`，并且精确命中本次请求的 `candidates`；
- `action` 为 `pass` 时不使用 `candidateId`，且本地必须允许当前玩家过牌；
- `analysis` 是可选字段，缺少或格式不合法时保留动作、丢弃解释；
- 分析请求不依赖 `tableTalk`。现有叫分和 AI 自动出牌响应中的 `tableTalk` 兼容行为保持不变。

### 5.3 请求格式

新增分析专用选项和函数，避免把真人的咨询请求误当成 AI 自动行动：

```ts
export type AnalysisDecisionOptions = {
  state: GameState
  playerId: number
  mode: 'analysis'
  candidates: PlayCandidate[]
  fallback: Card[] | null
  fetcher?: DecisionFetch
}

export async function requestAIAnalysis(
  options: AnalysisDecisionOptions,
): Promise<AIAnalysisResult>
```

请求 payload 沿用 `createDecisionPayload` 的公开信息结构，但 `mode` 为 `analysis`，并携带真人当前手牌、地主信息、各家剩余张数、上一次牌型、最近最多 8 条出牌记录以及合法 `candidates`。不携带任何对手具体手牌。

### 5.4 分析结果

分析函数返回一个不会直接驱动游戏状态的结果：

```ts
export type AIAnalysisResult = {
  status: 'ready' | 'unavailable'
  action: 'play' | 'pass'
  candidate: PlayCandidate | null
  analysis: AIAnalysis | null
  source: 'deepseek' | 'fallback'
  message?: string
}
```

- DeepSeek 返回合法 `play`：`status: 'ready'`，`candidate` 为本地候选，`analysis` 为清洗后的对象或 `null`；
- DeepSeek 返回合法 `pass`：`status: 'ready'`，`candidate: null`；
- HTTP 错误、超时、JSON 解析失败、非法动作或非法候选：`status: 'unavailable'`，使用本地 `fallback` 精确匹配的候选（若存在），`analysis: null`；
- 所有失败路径都只能返回展示数据，不能调用 `playCards`、`passTurn` 或改变 `GameState`。

现有 `AIDecision` 的 `play`、`pass` 和 `bid` 分支可以携带可选的 `analysis?: AIAnalysis`。只有验证通过且确实存在有效分析对象时才添加该字段，以保持现有没有分析字段时的返回对象形状和测试兼容性。

## 6. DeepSeek Prompt 约束

在 `api/_deepseekProxy.ts` 中扩展系统提示：

- `mode: "analysis"` 时只输出上述分析 JSON，不输出 Markdown、思考过程或额外字段；
- 只能从 `candidates` 中选择，不得编造牌；
- `pass` 只能在候选不能合法压过上家时使用，最终仍由客户端校验；
- 只能根据当前玩家手牌、各家剩余张数、地主身份和公开出牌历史推断对手；
- 不得声称看到了对手的具体手牌；
- `why` 要说明牌效、拆牌、控制牌或结束牌权中的主要原因；
- `opponent` 要说明少牌方压力、地主/农民关系或上家牌权等公开因素；
- `factors` 只返回短标签，最多 3 项；
- 为容纳解释字段，分析请求的最大 token 数需要高于当前仅返回短 `tableTalk` 的设置，但仍保持短响应和已有超时机制。

叫分和 AI 自动行动的原有 prompt 语义继续工作，不能因为新增 `analysis` 格式破坏现有 `bid` 和 `play` 响应。

## 7. 游戏状态生命周期

`DoudizhuGame` 新增独立的分析状态，不把分析状态塞进 `GameState`。分析请求的触发条件是：

```text
hasStarted === true
phase === "playing"
currentPlayerIndex === 0
```

请求流程：

1. 真人回合开始时，使用当前手牌和 `lastPlay` 生成候选；清空旧结果并设置 `loading`；
2. 使用一个由回合、手牌 ID、上一次牌型和出牌历史长度组成的请求 key，保证同一个局面只请求一次；
3. 调用 `requestAIAnalysis`，只接收展示结果；
4. 响应返回前若回合 key 已改变、组件已卸载或清理函数已执行，则丢弃响应；
5. 响应返回后只在 key 仍匹配时设置 `ready` 或 `unavailable`；
6. 真人出牌、过牌、进入叫分、进入结算或开始新局时，旧结果立即隐藏；
7. 选中或取消选牌不会改变分析请求 key，也不会因每次点击牌而重复请求。

分析建议不自动写入 `selectedCardIds`，也不提供“一键按建议出牌”按钮。真人仍通过现有出牌和不出按钮完成动作。

## 8. 错误与降级矩阵

| 情况                        | 面板行为                     | 游戏行为           |
| --------------------------- | ---------------------------- | ------------------ |
| API key 缺失                | 显示不可用，可显示本地建议   | 正常手动出牌       |
| DeepSeek 超时或 HTTP 错误   | 显示不可用，可显示本地建议   | 正常手动出牌       |
| 返回非法 JSON               | 显示不可用                   | 正常手动出牌       |
| 返回非法 `candidateId`      | 显示不可用，不显示模型建议牌 | 正常手动出牌       |
| 返回合法候选但无 `analysis` | 显示候选和“暂无详细分析”     | 正常手动出牌       |
| 返回合法 `pass`             | 显示“不出”和解释             | 不自动过牌         |
| 回合在请求期间变化          | 丢弃旧响应，隐藏旧面板       | 按正常游戏状态继续 |

本地 fallback 只用于给失败状态提供可选的建议牌，不生成或伪造 `why`、`opponent`、`factors`。

## 9. 测试策略

### 9.1 `src/game/deepseekAI.ts` 相关测试

在现有 `tests/deepseekDecision.test.ts` 附近增加：

- `mode: analysis` payload 包含合法候选和公开局面信息；
- 合法 `candidateId` 返回 `ready`，且结果中的候选来自本地候选对象；
- 非法 `candidateId` 返回 `unavailable`，不会接受模型牌面；
- 合法 `pass` 只有在本地允许过牌时才接受；
- 缺少 `analysis` 时动作仍然有效，`analysis` 为 `null`；
- `analysis` 字段类型错误、超长或包含超过 3 个因素时被清洗或整体丢弃；
- 网络失败、非 2xx 响应和解析异常都返回不可用结果；
- 现有 AI 自动出牌和叫分测试的精确对象断言继续通过。

### 9.2 `api/_deepseekProxy.ts` 相关测试

在现有 `tests/deepseekProxy.test.ts` 增加：

- DeepSeek 返回分析 JSON 时，proxy 原样返回解析后的 `analysis`；
- 请求发送给模型的 system prompt 明确 `mode: analysis`、候选限制和不猜测隐藏手牌；
- 既有叫分响应仍然可解析，`tableTalk` 兼容测试继续通过；
- API key 缺失和上游错误的状态码保持不变。

### 9.3 静态和手动验证

项目当前没有专用 React 组件测试基础设施，因此组件状态需要通过：

- `bun test`；
- `bun run lint`；
- `bun run build`；
- 启动 `bun dev` 后验证桌面和窄屏：真人回合加载、完成、失败、出牌后清除、回合竞态和叫分/结算阶段隐藏。

## 10. 实现文件范围

预计涉及：

- 新增 `src/components/AIAnalysisPanel.tsx`；
- 修改 `src/game/deepseekAI.ts`；
- 修改 `api/_deepseekProxy.ts`；
- 修改 `src/components/DoudizhuGame.tsx`；
- 修改 `src/game.css`；
- 修改 `tests/deepseekDecision.test.ts`；
- 修改 `tests/deepseekProxy.test.ts`。

不修改游戏规则、`GameState` 的持久化结构、牌型识别算法或现有 AI 自动回合的执行顺序。

## 11. 验收标准

1. 只有真人处于 `playing` 回合时，左上角才显示分析面板。
2. 面板显示的建议牌一定来自本地合法候选，模型无法通过自然语言绕过校验。
3. 分析请求不会自动出牌、自动过牌、改变选牌或阻塞手动操作。
4. 成功响应能够显示建议、原因、对手考虑和最多 3 个判断依据标签。
5. 缺失或异常解释不会破坏合法建议牌；请求失败不会留下上一回合的旧分析。
6. 回合快速变化时，旧响应不会覆盖新回合内容。
7. 现有叫分、AI 自动出牌、过牌和结算逻辑行为保持不变。
8. `bun test`、`bun run lint` 和 `bun run build` 均通过，且桌面和窄屏手动检查无明显遮挡或溢出。
