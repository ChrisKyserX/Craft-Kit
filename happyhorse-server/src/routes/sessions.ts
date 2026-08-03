import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { sessions, messages } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { optionalAuth, type AppVariables } from '../lib/auth'

const sessionsRoute = new Hono<{ Variables: AppVariables }>()

const sessionSchema = z.object({
  title: z.string().max(300).optional(),
  agentType: z.enum(['general', 'video', 'coding']).optional(),
})

function getParam(c: any, name: string): string {
  return c.req.param(name) || ''
}

sessionsRoute.get('/projects/:projectId/sessions', optionalAuth, async (c) => {
  const projectId = getParam(c, 'projectId')
  if (!projectId) return c.json({ error: 'Missing projectId' }, 400)
  const rows = await db.select()
    .from(sessions)
    .where(eq(sessions.projectId, projectId))
    .orderBy(desc(sessions.updatedAt))
  return c.json(rows)
})

sessionsRoute.post('/projects/:projectId/sessions', optionalAuth, async (c) => {
  const projectId = getParam(c, 'projectId')
  if (!projectId) return c.json({ error: 'Missing projectId' }, 400)
  const body = await c.req.json()
  const parsed = sessionSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const [session] = await db.insert(sessions).values({
    projectId,
    title: parsed.data.title || '新会话',
    agentType: parsed.data.agentType || 'general',
  }).returning()

  return c.json(session, 201)
})

sessionsRoute.put('/sessions/:id', optionalAuth, async (c) => {
  const id = getParam(c, 'id')
  if (!id) return c.json({ error: 'Missing session id' }, 400)
  const body = await c.req.json()
  const parsed = sessionSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const [session] = await db.update(sessions)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(sessions.id, id))
    .returning()

  if (!session) return c.json({ error: '会话不存在' }, 404)
  return c.json(session)
})

sessionsRoute.delete('/sessions/:id', optionalAuth, async (c) => {
  const id = getParam(c, 'id')
  if (!id) return c.json({ error: 'Missing session id' }, 400)
  const [session] = await db.delete(sessions)
    .where(eq(sessions.id, id))
    .returning()

  if (!session) return c.json({ error: '会话不存在' }, 404)
  return c.json({ success: true })
})

sessionsRoute.get('/sessions/:id/messages', optionalAuth, async (c) => {
  const id = getParam(c, 'id')
  if (!id) return c.json({ error: 'Missing session id' }, 400)
  const rows = await db.select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.createdAt)
  return c.json(rows)
})

export default sessionsRoute