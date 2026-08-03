import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV1 } from 'ai'

interface LLMConfig {
  provider: string
  apiKey: string
  baseUrl?: string
  model: string
}

export function createProvider(config: LLMConfig): LanguageModelV1 {
  switch (config.provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })
      return anthropic(config.model)
    }
    case 'openai': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
      })
      return openai(config.model)
    }
    case 'deepseek':
    case 'dashscope': {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || (
          config.provider === 'deepseek'
            ? 'https://api.deepseek.com/v1'
            : 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        ),
      })
      return openai(config.model)
    }
    default:
      throw new Error(`不支持的 provider: ${config.provider}`)
  }
}
