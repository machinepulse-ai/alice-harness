import { createUserMessage, expandAssistantStream } from '@deepseek-ai/dsh-llm'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import * as Retry from '../src/index.ts'

let context: Context | undefined
let closeServer: (() => Promise<void>) | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  await closeServer?.()
  closeServer = undefined
  vi.unstubAllEnvs()
})

const chunk = (delta: object, finish: string | null = null): string =>
  JSON.stringify({ choices: [{ delta, index: 0, finish_reason: finish }] })

/**
 * An OpenAI-compatible gateway that cuts the first response mid-stream with an
 * in-band `error` chunk carrying `cutMessage`, then answers the next request.
 */
async function gateway(cutMessage: string): Promise<{ baseURL: string; requests: string[] }> {
  const requests: string[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (data: Buffer) => { body += data.toString('utf8') })
    request.on('end', () => {
      requests.push(body)
      const events = requests.length === 1
        ? [chunk({ role: 'assistant', content: '' }), chunk({ content: 'discard me' }), JSON.stringify({ error: { message: cutMessage } })]
        : [
          chunk({ role: 'assistant', content: '' }),
          chunk({ content: 'recovered response' }),
          JSON.stringify({ choices: [{ delta: {}, index: 0, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2 } }),
          '[DONE]',
        ]
      response.writeHead(200, { 'content-type': 'text/event-stream' })
      response.end(events.map(event => `data: ${event}\n\n`).join(''))
    })
  })
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  closeServer = () => new Promise((resolve) => { server.close(() => { resolve() }) })
  return { baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, requests }
}

describe('bounded retry through the real pi-ai OpenAI-completions adapter', () => {
  it.each([
    'Upstream response stream was interrupted',
    'Upstream HTTP/2 stream failed',
  ])('retries a gateway cut %j without committing the failed chunks', async (cutMessage) => {
    const server = await gateway(cutMessage)
    vi.stubEnv('GATEWAY_TEST_KEY', 'test-key')
    context = new Context()
    await mountAgentLoopTestDependencies(context)
    await context.plugin(LlmPiAi, {
      providers: {
        gateway: {
          apiKeyEnv: 'GATEWAY_TEST_KEY',
          api: 'openai-completions',
          baseURL: server.baseURL,
          models: [{ id: 'gateway-model' }],
          retryPolicy: { mode: 'normal', maxRetries: 2, backoff: { initialDelayMs: 10, maxDelayMs: 10, jitterRatio: 0 } },
        },
      },
    })
    await context.plugin(Retry)
    await context.plugin(AgentLoop, { agents: [] })
    const agent = await context.agentLoop.create(SessionId('gateway-cut'), { provider: 'gateway', model: 'gateway-model' })

    const idle = agent.whenIdle()
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'answer through the gateway' }], source: { kind: 'user' } }))
    await idle

    const events = agent.session.snapshotEvents()
    expect(server.requests).toHaveLength(2)
    expect(server.requests[0]).toEqual(server.requests[1])
    const retries = events.filter((event): event is SessionEvent<'llm/retry'> => event.type === 'llm/retry')
    expect(retries.map(event => event.data.failure)).toEqual([{ message: cutMessage, code: 'TRANSPORT' }])
    const failedAttempt = events.find((event): event is SessionEvent<'assistant/attempt'> => event.type === 'assistant/attempt')
    expect(expandAssistantStream(failedAttempt!.data.stream).some(item => item.chunk.type === 'text-delta')).toBe(true)
    const messages = events.filter((event): event is SessionEvent<'assistant/message'> => event.type === 'assistant/message')
    expect(messages.map(event => event.data.message.content)).toEqual([[{ type: 'text', text: 'recovered response' }]])
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  })
})
