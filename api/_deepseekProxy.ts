type Env = Partial<
  Record<'DEEPSEEK_API_KEY' | 'DEEPSEEK_MODEL' | 'DEEPSEEK_TIMEOUT_MS', string>
>
type DecisionFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>

interface HandlerOptions {
  env: Env
  fetcher?: DecisionFetch
}

export function createDeepSeekDecisionHandler(options: HandlerOptions) {
  return async function handleDeepSeekDecision(
    request: Request,
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' })
    }

    const apiKey = options.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return jsonResponse(503, { error: 'DEEPSEEK_API_KEY is not configured' })
    }

    try {
      const payload = await request.json()
      const decision = await requestDeepSeekDecision(payload, {
        apiKey,
        model: options.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        timeoutMs: Number(options.env.DEEPSEEK_TIMEOUT_MS || 3000),
        fetcher: options.fetcher ?? fetch,
      })

      return jsonResponse(200, decision)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'DeepSeek request failed'
      return jsonResponse(502, { error: message })
    }
  }
}

async function requestDeepSeekDecision(
  payload: unknown,
  options: {
    apiKey: string
    model: string
    timeoutMs: number
    fetcher: DecisionFetch
  },
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)

  try {
    const response = await options.fetcher(
      'https://api.deepseek.com/chat/completions',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            {
              role: 'system',
              content: [
                '你是湖州四人两副牌斗地主的电脑玩家决策器。',
                '只从用户提供的 legalBids 或 candidates 中选择，不能编造牌。',
                '目标是会赢但自然：合理牌效、农民配合、地主压制、保留炸弹和王，不故意犯明显错误。',
                '出牌基本原则：优先选择能整理手牌的低风险候选；同样能出时选较小的普通牌。',
                '不要开局或中局主动出炸弹、火箭、2、王，除非能直接走完、阻止对手走完，或没有普通候选能压过上家。',
                '如果 candidates 中同时有普通牌和炸弹/火箭，通常选普通牌；炸弹/火箭是最后手段。',
                '只输出 JSON，不要 Markdown，不要解释。',
                '叫分格式：{"action":"bid","bid":0|1|2|3,"tableTalk":"不超过12字的可选短句"}。',
                '出牌格式：{"action":"play","candidateId":"候选id","tableTalk":"不超过12字的可选短句"} 或 {"action":"pass","tableTalk":"不超过12字的可选短句"}。',
                '分析格式：{"action":"play","candidateId":"候选id","analysis":{"why":"不超过120字","opponent":"不超过120字","factors":["短标签"]}} 或 {"action":"pass","analysis":{"why":"不超过120字","opponent":"不超过120字","factors":["短标签"]}}。',
                'mode: analysis 时只输出动作、候选和 analysis，不输出 Markdown 或思考过程。',
                '只能根据公开信息推断对手，不得声称看到了对手的具体手牌。',
                'analysis.factors 最多输出 3 个短标签。',
              ].join('\n'),
            },
            {
              role: 'user',
              content: JSON.stringify(payload),
            },
          ],
          thinking: { type: 'disabled' },
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 260,
          stream: false,
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`DeepSeek HTTP ${response.status}`)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('DeepSeek returned empty content')
    }

    return JSON.parse(content)
  } finally {
    clearTimeout(timer)
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, { status })
}
