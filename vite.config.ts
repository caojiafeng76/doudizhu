import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createDeepSeekDecisionHandler } from './api/_deepseekProxy.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), deepSeekProxyPlugin(env)],
  }
})

function deepSeekProxyPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'deepseek-local-proxy',
    configureServer(server) {
      const handler = createDeepSeekDecisionHandler({ env })

      server.middlewares.use('/api/deepseek/decision', async (req, res) => {
        const request = await toWebRequest(req, 'http://localhost/api/deepseek/decision')
        const response = await handler(request)
        await sendWebResponse(res, response)
      })
    },
  }
}

async function toWebRequest(req: IncomingMessage, url: string): Promise<Request> {
  const body = await readBody(req)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    } else if (value) {
      headers.set(key, value)
    }
  }

  return new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  })
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(Buffer.from(await response.arrayBuffer()))
}
