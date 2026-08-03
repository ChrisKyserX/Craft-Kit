import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { messages, sessions, llmConfigs } from '../db/schema'
import { eq } from 'drizzle-orm'
import { optionalAuth, type AppVariables } from '../lib/auth'
import { sseResponse } from '../lib/sse'
import { runAgent } from '../agent/run'
import '../tools'

const chat = new Hono<{ Variables: AppVariables }>()

const chatSchema = z.object({
  message: z.string().min(1),
  llmConfigId: z.string().optional(),
  llmConfig: z.object({
    provider: z.string(),
    apiKey: z.string(),
    baseUrl: z.string().optional(),
    model: z.string(),
  }).optional(),
})

chat.post('/sessions/:id/chat', optionalAuth, async (c) => {
  const sessionId = c.req.param('id')!
  const body = await c.req.json()
  const parsed = chatSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const { message, llmConfigId, llmConfig: localConfig } = parsed.data

  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  if (!session) {
    return c.json({ error: 'Session not found. Create a session first via POST /api/projects/:id/sessions' }, 404)
  }

  let llmConfig: { provider: string; apiKey: string; baseUrl?: string; model: string }
  if (localConfig) {
    llmConfig = localConfig
  } else {
    const user = c.var.user
    if (user && llmConfigId) {
      const [config] = await db.select().from(llmConfigs)
        .where(eq(llmConfigs.id, llmConfigId))
        .limit(1)
      if (config) {
        llmConfig = {
          provider: config.provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || undefined,
          model: config.defaultModel,
        }
      } else {
        return c.json({ error: 'LLM config not found' }, 404)
      }
    } else if (user) {
      const [config] = await db.select().from(llmConfigs)
        .where(eq(llmConfigs.userId, user.userId))
        .limit(1)
      if (config) {
        llmConfig = {
          provider: config.provider,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl || undefined,
          model: config.defaultModel,
        }
      } else {
        return c.json({ error: 'No LLM config found' }, 400)
      }
    } else {
      return c.json({ error: 'Provide LLM config or login' }, 400)
    }
  }

  try {
    await db.insert(messages).values({
      sessionId,
      role: 'user',
      content: message,
    })
  } catch (err: any) {
    console.error('[Chat] Failed to save user message:', err.message)
    return c.json({ error: err.message }, 500)
  }

  const history = await db.select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)

  const historyMessages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content || '' }))

  if (historyMessages.length === 1) {
    const title = message.slice(0, 50) + (message.length > 50 ? '...' : '')
    await db.update(sessions).set({ title, updatedAt: new Date() }).where(eq(sessions.id, sessionId))
  }

  return sseResponse(async (sse) => {
    const result = await runAgent({
      agentType: session.agentType,
      messages: historyMessages,
      llmConfig,
      sessionId,
      sse,
    })

    const assistantContent = result.text || ''
    console.log(`[Chat] Saving assistant message: sessionId=${sessionId}, contentLen=${assistantContent.length}`)
    try {
      await db.insert(messages).values({
        sessionId,
        role: 'assistant',
        content: assistantContent,
      })
      await db.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.id, sessionId))
    } catch (err: any) {
      console.error(`[Chat] Failed to save message:`, err.message)
    }
  })
})

export default chat