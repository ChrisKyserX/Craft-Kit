import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { llmConfigs } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth, type AppVariables } from '../lib/auth'

const configs = new Hono<{ Variables: AppVariables }>()

const llmConfigSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'dashscope']),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1),
  isDefault: z.boolean().optional(),
})

configs.get('/llm', requireAuth, async (c) => {
  const user = c.var.user
  const rows = await db.select().from(llmConfigs).where(eq(llmConfigs.userId, user.userId))
  return c.json(rows)
})

configs.post('/llm/test', requireAuth, async (c) => {
  const body = await c.req.json()
  const { provider, apiKey, baseUrl, model } = body
  console.log(`[Test] Provider: ${provider}, Model: ${model}, BaseURL: ${baseUrl || 'default'}`)
  try {
    const { createProvider } = await import('../lib/llm')
    const m = createProvider({ provider, apiKey, baseUrl, model })
    const { generateText } = await import('ai')
    const result = await generateText({
      model: m,
      prompt: 'Say "ok"',
      maxTokens: 10,
    })
    console.log(`[Test] Success: ${result.text}`)
    return c.json({ ok: true, model, response: result.text })
  } catch (err: any) {
    console.error(`[Test] Failed:`, err.message)
    return c.json({ error: err.message || '连接失败' }, 400)
  }
})

configs.post('/llm', requireAuth, async (c) => {
  const user = c.var.user
  const body = await c.req.json()
  const parsed = llmConfigSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const { isDefault, ...data } = parsed.data

  if (isDefault) {
    await db.update(llmConfigs).set({ isDefault: false }).where(eq(llmConfigs.userId, user.userId))
  }

  const [config] = await db.insert(llmConfigs).values({
    ...data,
    userId: user.userId,
    isDefault: isDefault ?? false,
  }).returning()

  return c.json(config, 201)
})

configs.put('/llm/:id', requireAuth, async (c) => {
  const user = c.var.user
  const id = c.req.param('id')!
  const body = await c.req.json()
  const parsed = llmConfigSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const { isDefault, ...data } = parsed.data

  if (Object.keys(parsed.data).length === 0) {
    return c.json({ error: '没有需要更新的字段' }, 400)
  }

  if (isDefault) {
    await db.update(llmConfigs).set({ isDefault: false }).where(eq(llmConfigs.userId, user.userId))
  }

  const [config] = await db.update(llmConfigs)
    .set({ ...data, ...(isDefault !== undefined ? { isDefault } : {}) })
    .where(and(eq(llmConfigs.id, id), eq(llmConfigs.userId, user.userId)))
    .returning()

  if (!config) {
    return c.json({ error: '配置不存在' }, 404)
  }
  return c.json(config)
})

configs.delete('/llm/:id', requireAuth, async (c) => {
  const user = c.var.user
  const id = c.req.param('id')!

  const [config] = await db.delete(llmConfigs)
    .where(and(eq(llmConfigs.id, id), eq(llmConfigs.userId, user.userId)))
    .returning()

  if (!config) {
    return c.json({ error: '配置不存在' }, 404)
  }
  return c.json({ success: true })
})

export default configs
