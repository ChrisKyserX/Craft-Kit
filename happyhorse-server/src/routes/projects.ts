import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { projects } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { optionalAuth, type AppVariables } from '../lib/auth'

const projectsRoute = new Hono<{ Variables: AppVariables }>()

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
})

projectsRoute.get('/', optionalAuth, async (c) => {
  const user = c.var.user
  if (!user) return c.json([])

  const rows = await db.select()
    .from(projects)
    .where(eq(projects.userId, user.userId))
    .orderBy(desc(projects.updatedAt))
  return c.json(rows)
})

projectsRoute.post('/', optionalAuth, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ error: '请先登录' }, 401)

  const body = await c.req.json()
  const parsed = projectSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const [project] = await db.insert(projects).values({
    ...parsed.data,
    userId: user.userId,
  }).returning()

  return c.json(project, 201)
})

projectsRoute.put('/:id', optionalAuth, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ error: '请先登录' }, 401)

  const id = c.req.param('id')!
  const body = await c.req.json()
  const parsed = projectSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const [project] = await db.update(projects)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.userId, user.userId)))
    .returning()

  if (!project) return c.json({ error: '项目不存在' }, 404)
  return c.json(project)
})

projectsRoute.delete('/:id', optionalAuth, async (c) => {
  const user = c.var.user
  if (!user) return c.json({ error: '请先登录' }, 401)

  const id = c.req.param('id')!
  const [project] = await db.delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.userId)))
    .returning()

  if (!project) return c.json({ error: '项目不存在' }, 404)
  return c.json({ success: true })
})

export default projectsRoute
