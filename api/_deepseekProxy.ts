type Env = Partial<Record<'DEEPSEEK_API_KEY' | 'DEEPSEEK_MODEL' | 'DEEPSEEK_TIMEOUT_MS', string>>
type DecisionFetch = (input: string | URL, init?: RequestInit) => Promise<Response>

interface HandlerOptions {
  env: Env
  fetcher?: DecisionFetch
}

export function createDeepSeekDecisionHandler(options: HandlerOptions) {
  return async function handleDeepSeekDecision(request: Request): Promise<Response> {
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
      const message = error instanceof Error ? error.message : 'DeepSeek request failed'
      return jsonResponse(502, { error: message })
    }
  }
}

async function requestDeepSeekDecision(
  payload: unknown,
  options: { apiKey: string; model: string; timeoutMs: number; fetcher: DecisionFetch }
): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs)

  try {
    const response = await options.fetcher('https://api.deepseek.com/chat/completions', {
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
              '目标是会赢但自然：合理牌效、农民配合、地主压制、保留炸弹，不故意犯明显错误。',
              '只输出 JSON，不要 Markdown，不要解释。',
              '叫分格式：{"action":"bid","bid":0|1|2|3,"tableTalk":"不超过12字的可选短句"}。',
              '出牌格式：{"action":"play","candidateId":"候选id","tableTalk":"不超过12字的可选短句"} 或 {"action":"pass","tableTalk":"不超过12字的可选短句"}。',
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
        max_tokens: 160,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`DeepSeek HTTP ${response.status}`)
    }

    const data = await response.json() as {
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
