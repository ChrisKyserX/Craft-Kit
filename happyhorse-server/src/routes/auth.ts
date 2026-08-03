import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { signToken, requireAuth, type AppVariables } from '../lib/auth'

const auth = new Hono<{ Variables: AppVariables }>()

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

auth.post('/register', async (c) => {
  const body = await c.req.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const { email, password, name } = parsed.data

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    return c.json({ error: '邮箱已注册' }, 409)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning()

  const token = signToken({ userId: user.id, email: user.email })
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } }, 201)
})

auth.post('/login', async (c) => {
  const body = await c.req.json()
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const { email, password } = parsed.data

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    return c.json({ error: '邮箱或密码错误' }, 401)
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return c.json({ error: '邮箱或密码错误' }, 401)
  }

  const token = signToken({ userId: user.id, email: user.email })
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name } })
})

auth.get('/me', requireAuth, async (c) => {
  const payload = c.var.user
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
  }).from(users).where(eq(users.id, payload.userId)).limit(1)

  if (!user) {
    return c.json({ error: '用户不存在' }, 404)
  }
  return c.json(user)
})

export default auth
