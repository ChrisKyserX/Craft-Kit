import { streamText } from 'ai'
import { createProvider } from '../lib/llm'
import { toolRegistry, type ToolContext } from './tool-registry'
import { getAgentDefinition } from './registry'
import type { SSEController } from '../lib/sse'

interface RunAgentInput {
  agentType: string
  messages: Array<{ role: string; content: string }>
  llmConfig: {
    provider: string
    apiKey: string
    baseUrl?: string
    model: string
  }
  sessionId: string
  sse: SSEController
}

export async function runAgent(input: RunAgentInput) {
  const { agentType, messages, llmConfig, sessionId, sse } = input

  console.log(`[Agent] Session: ${sessionId}`)
  console.log(`[Agent] Type: ${agentType}, Provider: ${llmConfig.provider}, Model: ${llmConfig.model}`)
  console.log(`[Agent] Messages: ${messages.length} history messages`)

  const agentDef = getAgentDefinition(agentType)
  console.log(`[Agent] Tools: ${agentDef.tools.join(', ')}`)

  const model = createProvider({
    provider: llmConfig.provider,
    apiKey: llmConfig.apiKey,
    baseUrl: llmConfig.baseUrl,
    model: llmConfig.model,
  })

  const toolContext: ToolContext & { apiKey: string } = {
    sessionId,
    apiKey: llmConfig.apiKey,
    sendEvent(event) {
      const logMsg = `[Tool] ${event.name}(${event.id}) -> ${event.status}${event.message ? ': ' + event.message : ''}`
      console.log(logMsg)
      switch (event.status) {
        case 'running':
          sse.sendEvent('tool-start', event)
          break
        case 'polling':
          sse.sendEvent('tool-progress', event)
          break
        case 'completed':
          sse.sendEvent('tool-result', event)
          break
        case 'failed':
          sse.sendEvent('tool-error', event)
          break
        default:
          sse.sendEvent('tool-call', event)
          break
      }
    },
  }

  const wrappedTools: Record<string, any> = {}
  for (const name of agentDef.tools) {
    const def = toolRegistry.get(name)
    if (def) {
      wrappedTools[name] = {
        description: def.description,
        parameters: def.parameters,
        execute: (args: Record<string, unknown>) => def.execute(args, toolContext),
      }
    }
  }

  console.log(`[Agent] Starting streamText with ${Object.keys(wrappedTools).length} tools...`)
  console.log(`[Agent] Tool names:`, Object.keys(wrappedTools))
  const result = streamText({
    model,
    system: agentDef.systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
    tools: wrappedTools,
  })

  for await (const chunk of result.fullStream) {
    console.log(`[Agent] Chunk: ${chunk.type}`)
    switch (chunk.type) {
      case 'text-delta':
        sse.sendEvent('text', { text: chunk.textDelta })
        break
      case 'tool-call':
        console.log(`[Agent] LLM requested tool: ${chunk.toolName}(${chunk.toolCallId})`)
        sse.sendEvent('tool-call', {
          id: chunk.toolCallId,
          name: chunk.toolName,
          args: chunk.args,
        })
        break
      case 'error':
        console.error(`[Agent] API Error:`, JSON.stringify((chunk as any).error))
        // 降级：不带 tools 重试
        console.log(`[Agent] ⚠️ Got error chunk, retrying without tools...`)
        const retryResult = streamText({
          model,
          system: agentDef.systemPrompt,
          messages: messages.map(m => ({
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
          })),
        })
        console.log(`[Agent] Retry streamText created, waiting for chunks...`)
        for await (const chunk of retryResult.fullStream) {
          console.log(`[Agent] Retry chunk: ${chunk.type}`)
          if (chunk.type === 'text-delta') {
            sse.sendEvent('text', { text: chunk.textDelta })
          } else if (chunk.type === 'error') {
            console.error(`[Agent] Retry error:`, JSON.stringify((chunk as any).error))
            sse.sendEvent('error', { error: (chunk as any).error?.message || '请求失败' })
          }
        }
        console.log(`[Agent] Retry stream ended, getting usage...`)
        const retryUsage = await retryResult.usage
        const retryText = await retryResult.text
        console.log(`[Agent] Retry done. Tokens: in=${retryUsage?.promptTokens || 0} out=${retryUsage?.completionTokens || 0}`)
        sse.sendEvent('done', { usage: { inputTokens: retryUsage?.promptTokens || 0, outputTokens: retryUsage?.completionTokens || 0 } })
        return { text: retryText, usage: retryUsage }
    }
  }

  const usage = await result.usage
  const finalText = await result.text

  console.log(`[Agent] Done. Tokens: in=${usage?.promptTokens || 0} out=${usage?.completionTokens || 0}`)

  sse.sendEvent('done', {
    usage: {
      inputTokens: usage?.promptTokens || 0,
      outputTokens: usage?.completionTokens || 0,
    },
  })

  return { text: finalText, usage }
}