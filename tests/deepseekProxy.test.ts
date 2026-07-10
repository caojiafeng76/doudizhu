import { describe, expect, test } from 'bun:test'
import { createDeepSeekDecisionHandler } from '../api/_deepseekProxy.ts'

const validPayload = {
  mode: 'bid',
  playerId: 1,
  legalBids: [0, 1, 2, 3],
}

describe('DeepSeek proxy handler', () => {
  test('rejects non-POST requests', async () => {
    const handler = createDeepSeekDecisionHandler({
      env: { DEEPSEEK_API_KEY: 'test-key' },
      fetcher: async () => new Response(),
    })

    const response = await handler(
      new Request('https://example.com/api/deepseek/decision'),
    )

    expect(response.status).toBe(405)
    expect(await response.json()).toEqual({ error: 'Method not allowed' })
  })

  test('returns service unavailable when the API key is missing', async () => {
    const handler = createDeepSeekDecisionHandler({
      env: {},
      fetcher: async () => new Response(),
    })

    const response = await handler(
      new Request('https://example.com/api/deepseek/decision', {
        method: 'POST',
        body: JSON.stringify(validPayload),
      }),
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'DEEPSEEK_API_KEY is not configured',
    })
  })

  test('returns the parsed DeepSeek JSON decision', async () => {
    const calls: Array<{
      url: string
      body: Record<string, unknown>
      authorization: string | null
    }> = []
    const handler = createDeepSeekDecisionHandler({
      env: {
        DEEPSEEK_API_KEY: 'test-key',
        DEEPSEEK_MODEL: 'deepseek-v4-flash',
        DEEPSEEK_TIMEOUT_MS: '3000',
      },
      fetcher: async (input, init) => {
        calls.push({
          url: String(input),
          body: JSON.parse(String(init?.body)),
          authorization: new Headers(init?.headers).get('authorization'),
        })

        return Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: 'bid',
                  bid: 2,
                  tableTalk: '我抢一下',
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
        body: JSON.stringify(validPayload),
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      action: 'bid',
      bid: 2,
      tableTalk: '我抢一下',
    })
    expect(calls[0].url).toBe('https://api.deepseek.com/chat/completions')
    expect(calls[0].authorization).toBe('Bearer test-key')
    expect(calls[0].body.model).toBe('deepseek-v4-flash')
  })

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
})
