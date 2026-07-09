import { createDeepSeekDecisionHandler } from '../_deepseekProxy.ts'

const handler = createDeepSeekDecisionHandler({
  env: {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
    DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL,
    DEEPSEEK_TIMEOUT_MS: process.env.DEEPSEEK_TIMEOUT_MS,
  },
})

export default {
  fetch: handler,
}
