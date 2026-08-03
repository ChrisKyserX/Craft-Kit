import jwt from 'jsonwebtoken'
import type { Context, Next } from 'hono'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export interface JwtPayload {
  userId: string
  email: string
}

export interface AppVariables {
  user: JwtPayload
}

export type AppContext = Context<{ Variables: AppVariables }>

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

export async function optionalAuth(c: AppContext, next: Next) {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7))
      c.set('user', payload)
    } catch {
      // token 无效，忽略，按未登录处理
    }
  }
  await next()
}

export async function requireAuth(c: AppContext, next: Next) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: '请先登录' }, 401)
  }
  try {
    const payload = verifyToken(header.slice(7))
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: '登录已过期，请重新登录' }, 401)
  }
}
