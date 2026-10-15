import { createUserMessage, expandAssistantStream } from '@deepseek-ai/dsh-llm'
import type { NormalRetryPolicyConfig } from '@deepseek-ai/dsh-llm'
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

/** An in-band `error` chunk that cuts the stream with `cutMessage`. */
const cut = (cutMessage: string): string[] =>
  [chunk({ role: 'assistant', content: '' }), chunk({ content: 'discard me' }), JSON.stringify({ error: { message: cutMessage } })]

/**
 * An OpenAI-compatible gateway that answers the first request with
 * `firstResponse`, then answers every later request normally.
 */
async function gateway(firstResponse: string[]): Promise<{ baseURL: string; requests: string[] }> {
  const requests: string[] = []
  const server = createServer((request, response) => {
    let body = ''
    request.on('data', (data: Buffer) => { body += data.toString('utf8') })
    request.on('end', () => {
      requests.push(body)
      const events = requests.length === 1
        ? firstResponse
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

async function compose(baseURL: string, retryPolicy: NormalRetryPolicyConfig): Promise<Context> {
  vi.stubEnv('GATEWAY_TEST_KEY', 'test-key')
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(LlmPiAi, {
    providers: {
      gateway: {
        apiKeyEnv: 'GATEWAY_TEST_KEY',
        api: 'openai-completions',
        baseURL,
        models: [{ id: 'gateway-model' }],
        retryPolicy: { ...retryPolicy, backoff: { initialDelayMs: 10, maxDelayMs: 10, jitterRatio: 0 } },
      },
    },
  })
  await ctx.plugin(Retry)
  await ctx.plugin(AgentLoop, { agents: [] })
  return ctx
}

describe('bounded retry through the real pi-ai OpenAI-completions adapter', () => {
  it.each([
    'Upstream response stream was interrupted',
    'Upstream HTTP/2 stream failed',
  ])('retries a gateway cut %j without committing the failed chunks', async (cutMessage) => {
    const server = await gateway(cut(cutMessage))
    context = await compose(server.baseURL, { mode: 'normal', maxRetries: 2 })
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

  it('retries a discarded step with the policy correction appended to the model context', async () => {
    // A Gemini-fronting gateway folds the model's unparseable tool call into
    // `content_filter`; the leaked call text is all the step delivered.
    const server = await gateway([
      chunk({ role: 'assistant', content: '' }),
      chunk({ content: 'call:default_api:bash{command:pwd,description:Show the directory}' }),
      chunk({}, 'content_filter'),
      '[DONE]',
    ])
    const correction = 'Your last tool call arrived as text and did not run; issue it again through function calling.'
    context = await compose(server.baseURL, {
      mode: 'normal',
      maxRetries: 2,
      retryableCodes: ['CONTENT_FILTER'],
      recoveryMessages: { CONTENT_FILTER: correction },
    })
    const agent = await context.agentLoop.create(SessionId('gateway-discarded-step'), { provider: 'gateway', model: 'gateway-model' })

    const idle = agent.whenIdle()
    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'where am I?' }], source: { kind: 'user' } }))
    await idle

    const events = agent.session.snapshotEvents()
    expect(server.requests).toHaveLength(2)
    const sent = server.requests.map(body => (JSON.parse(body) as { messages: { role: string; content: unknown }[] }).messages)
    expect(sent[0]!.at(-1)).toMatchObject({ role: 'user', content: 'where am I?' })
    expect(sent[1]!.slice(0, -1)).toEqual(sent[0])
    expect(sent[1]!.at(-1)).toMatchObject({ role: 'user', content: correction })
    expect(JSON.stringify(sent[1])).not.toContain('call:default_api')
    const retries = events.filter((event): event is SessionEvent<'llm/retry'> => event.type === 'llm/retry')
    expect(retries.map(event => event.data.failure)).toEqual([{
      message: 'model "gateway-model" stopped with finish_reason content_filter: the provider discarded the step\'s output (its content policy, or, through a gateway that folds Gemini finish reasons, a tool call it could not parse)',
      code: 'CONTENT_FILTER',
    }])
    const corrections = events.filter((event): event is SessionEvent<'user/message'> => event.type === 'user/message' && event.data.source.kind === 'plugin')
    expect(corrections.map(event => event.data)).toMatchObject([{
      content: [{ type: 'text', text: correction }],
      source: { kind: 'plugin', plugin: 'llm-retry', form: 'notice' },
    }])
    const messages = events.filter((event): event is SessionEvent<'assistant/message'> => event.type === 'assistant/message')
    expect(messages.map(event => event.data.message.content)).toEqual([[{ type: 'text', text: 'recovered response' }]])
    expect(events.at(-1)).toMatchObject({ type: 'turn/end', data: { reason: { kind: 'completed' } } })
  })
})
