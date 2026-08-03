# HappyHorse Agent Server 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从零搭建 HappyHorse Agent 后端服务，支持多专家 Agent、SSE 流式输出、多模型配置、用户认证。

**Architecture:** Hono HTTP 框架 + Vercel AI SDK agent 引擎 + Drizzle ORM + PostgreSQL。路由层处理 CRUD，agent 层通过 Tool Registry 统一管理工具，SSE 流式推送 agent 执行全过程。

**Tech Stack:** Node.js + TypeScript, Hono, Vercel AI SDK (@ai-sdk/anthropic, @ai-sdk/openai), Drizzle ORM, PostgreSQL, better-auth, JWT

---

## Phase 1: 项目骨架

### Task 1: 初始化项目

**Files:**
- Create: `happyhorse-server/package.json`
- Create: `happyhorse-server/tsconfig.json`
- Create: `happyhorse-server/.env.example`
- Create: `happyhorse-server/.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "happyhorse-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "ai": "^4.0.0",
    "better-auth": "^1.0.0",
    "drizzle-orm": "^0.38.0",
    "hono": "^4.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "uuid": "^10.0.0",
    "postgres": "^3.4.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "drizzle-kit": "^0.28.0",
    "tsx": "^4.0.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: 创建 .env.example**

```bash
DATABASE_URL=postgresql://user:password@host:5432/happyhorse
JWT_SECRET=change-me-to-a-random-string
PORT=3000
```

- [ ] **Step 4: 创建 .gitignore**

```gitignore
node_modules
dist
.env
*.local
```

- [ ] **Step 5: 安装依赖**

```bash
cd happyhorse-server && npm install
```

- [ ] **Step 6: 创建 drizzle.config.ts**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 7: Commit**

```bash
git add happyhorse-server/
git commit -m "feat: scaffold happyhorse-server project"
```

---

### Task 2: 数据库 Schema 与连接

**Files:**
- Create: `happyhorse-server/src/db/schema.ts`
- Create: `happyhorse-server/src/db/index.ts`

- [ ] **Step 1: 创建 schema.ts**

```typescript
import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const llmConfigs = pgTable('llm_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  apiKey: text('api_key').notNull(),
  baseUrl: varchar('base_url', { length: 255 }),
  defaultModel: varchar('default_model', { length: 100 }).notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 300 }),
  agentType: varchar('agent_type', { length: 50 }).notNull().default('general'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  content: text('content'),
  toolCalls: jsonb('tool_calls'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const agentConfigs = pgTable('agent_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  agentType: varchar('agent_type', { length: 50 }).notNull(),
  systemPrompt: text('system_prompt').notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  llmConfigId: uuid('llm_config_id').references(() => llmConfigs.id),
  tools: jsonb('tools').default('[]'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})
```

- [ ] **Step 2: 创建 db/index.ts**

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!
const client = postgres(connectionString)
export const db = drizzle(client, { schema })
```

- [ ] **Step 3: 生成并推送 schema**

```bash
cd happyhorse-server && npx drizzle-kit push
```

- [ ] **Step 4: Commit**

```bash
git add happyhorse-server/src/db/
git commit -m "feat: add database schema and connection"
```

---

## Phase 2: 认证系统

### Task 3: JWT 工具与认证中间件

**Files:**
- Create: `happyhorse-server/src/lib/auth.ts`

- [ ] **Step 1: 创建 lib/auth.ts**

```typescript
import jwt from 'jsonwebtoken'
import type { Context, Next } from 'hono'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

export interface JwtPayload {
  userId: string
  email: string
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload
}

// 可选认证中间件：不强制要求登录，但解析 token 如果存在
export async function optionalAuth(c: Context, next: Next) {
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

// 强制认证中间件
export async function requireAuth(c: Context, next: Next) {
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
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/lib/
git commit -m "feat: add JWT auth utilities and middleware"
```

---

### Task 4: 认证路由

**Files:**
- Create: `happyhorse-server/src/routes/auth.ts`

- [ ] **Step 1: 创建 routes/auth.ts**

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '../db'
import { users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { signToken, requireAuth } from '../lib/auth'

const auth = new Hono()

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
  const payload = c.get('user')
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
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/routes/auth.ts
git commit -m "feat: add auth routes (register, login, me)"
```

---

## Phase 3: LLM 配置 CRUD

### Task 5: LLM 配置路由

**Files:**
- Create: `happyhorse-server/src/routes/configs.ts`

- [ ] **Step 1: 创建 routes/configs.ts**

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { llmConfigs } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../lib/auth'

const configs = new Hono()

const llmConfigSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(['openai', 'anthropic', 'deepseek', 'dashscope']),
  apiKey: z.string().min(1),
  baseUrl: z.string().optional(),
  defaultModel: z.string().min(1),
  isDefault: z.boolean().optional(),
})

configs.get('/llm', requireAuth, async (c) => {
  const user = c.get('user')
  const rows = await db.select().from(llmConfigs).where(eq(llmConfigs.userId, user.userId))
  return c.json(rows)
})

configs.post('/llm', requireAuth, async (c) => {
  const user = c.get('user')
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
  const user = c.get('user')
  const id = c.req.param('id')
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
  const user = c.get('user')
  const id = c.req.param('id')

  const [config] = await db.delete(llmConfigs)
    .where(and(eq(llmConfigs.id, id), eq(llmConfigs.userId, user.userId)))
    .returning()

  if (!config) {
    return c.json({ error: '配置不存在' }, 404)
  }
  return c.json({ success: true })
})

export default configs
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/routes/configs.ts
git commit -m "feat: add LLM config CRUD routes"
```

---

## Phase 4: 项目与会话 CRUD

### Task 6: 项目路由

**Files:**
- Create: `happyhorse-server/src/routes/projects.ts`

- [ ] **Step 1: 创建 routes/projects.ts**

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { projects } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { optionalAuth } from '../lib/auth'

const projectsRoute = new Hono()

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
})

projectsRoute.get('/', optionalAuth, async (c) => {
  const user = c.get('user')
  if (!user) return c.json([])

  const rows = await db.select()
    .from(projects)
    .where(eq(projects.userId, user.userId))
    .orderBy(desc(projects.updatedAt))
  return c.json(rows)
})

projectsRoute.post('/', optionalAuth, async (c) => {
  const user = c.get('user')
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
  const user = c.get('user')
  if (!user) return c.json({ error: '请先登录' }, 401)

  const id = c.req.param('id')
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
  const user = c.get('user')
  if (!user) return c.json({ error: '请先登录' }, 401)

  const id = c.req.param('id')
  const [project] = await db.delete(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, user.userId)))
    .returning()

  if (!project) return c.json({ error: '项目不存在' }, 404)
  return c.json({ success: true })
})

export default projectsRoute
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/routes/projects.ts
git commit -m "feat: add project CRUD routes"
```

---

### Task 7: 会话路由

**Files:**
- Create: `happyhorse-server/src/routes/sessions.ts`

- [ ] **Step 1: 创建 routes/sessions.ts**

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { sessions, messages } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { optionalAuth } from '../lib/auth'

const sessionsRoute = new Hono()

const sessionSchema = z.object({
  title: z.string().max(300).optional(),
  agentType: z.enum(['general', 'video', 'coding']).optional(),
})

sessionsRoute.get('/projects/:projectId/sessions', optionalAuth, async (c) => {
  const projectId = c.req.param('projectId')
  const rows = await db.select()
    .from(sessions)
    .where(eq(sessions.projectId, projectId))
    .orderBy(desc(sessions.updatedAt))
  return c.json(rows)
})

sessionsRoute.post('/projects/:projectId/sessions', optionalAuth, async (c) => {
  const projectId = c.req.param('projectId')
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
  const id = c.req.param('id')
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
  const id = c.req.param('id')
  const [session] = await db.delete(sessions)
    .where(eq(sessions.id, id))
    .returning()

  if (!session) return c.json({ error: '会话不存在' }, 404)
  return c.json({ success: true })
})

sessionsRoute.get('/sessions/:id/messages', optionalAuth, async (c) => {
  const id = c.req.param('id')
  const rows = await db.select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(messages.createdAt)
  return c.json(rows)
})

export default sessionsRoute
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/routes/sessions.ts
git commit -m "feat: add session CRUD and message history routes"
```

---

## Phase 5: Agent 引擎核心

### Task 8: LLM Provider 工厂

**Files:**
- Create: `happyhorse-server/src/lib/llm.ts`

- [ ] **Step 1: 创建 lib/llm.ts**

```typescript
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
    // deepseek 和 dashscope 兼容 OpenAI 格式
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
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/lib/llm.ts
git commit -m "feat: add LLM provider factory"
```

---

### Task 9: Tool Registry

**Files:**
- Create: `happyhorse-server/src/agent/tool-registry.ts`

- [ ] **Step 1: 创建 agent/tool-registry.ts**

```typescript
import type { Tool } from 'ai'

interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

export interface ToolContext {
  sessionId: string
  sendEvent: (event: ToolEvent) => void
}

export interface ToolEvent {
  id: string
  name: string
  status: 'pending' | 'running' | 'polling' | 'completed' | 'failed'
  message?: string
  result?: unknown
  error?: string
}

class ToolRegistry {
  private tools: Map<string, ToolDef> = new Map()

  register(def: ToolDef) {
    this.tools.set(def.name, def)
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name)
  }

  list(): string[] {
    return Array.from(this.tools.keys())
  }

  toVercelTools(): Record<string, Tool> {
    const result: Record<string, Tool> = {}
    for (const [name, def] of this.tools.entries()) {
      result[name] = {
        description: def.description,
        parameters: def.parameters as any,
        execute: def.execute as any,
      }
    }
    return result
  }
}

export const toolRegistry = new ToolRegistry()
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/agent/tool-registry.ts
git commit -m "feat: add tool registry"
```

---

### Task 10: Agent 注册中心

**Files:**
- Create: `happyhorse-server/src/agent/registry.ts`

- [ ] **Step 1: 创建 agent/registry.ts**

```typescript
export interface AgentDefinition {
  type: string
  name: string
  systemPrompt: string
  tools: string[]
  defaultModel: string
}

const builtinAgents: Record<string, AgentDefinition> = {
  general: {
    type: 'general',
    name: '通用助手',
    systemPrompt: `你是一个通用 AI 助手。你可以使用工具来帮助用户完成任务。
在回答时，请先用文字说明你的思考过程，然后调用合适的工具。
如果用户的问题很简单，直接回答即可，不需要调用工具。`,
    tools: ['read_file', 'write_file', 'list_files', 'text_to_video', 'image_to_video', 'poll_video'],
    defaultModel: 'claude-sonnet-5',
  },
  video: {
    type: 'video',
    name: '视频生成专家',
    systemPrompt: `你是一个专业的视频生成助手。你擅长：
1. 分析用户的视频需求，帮助优化 prompt
2. 使用 text_to_video 工具生成文生视频
3. 使用 image_to_video 工具生成图生视频
4. 使用 poll_video 工具查询生成进度

在生成视频前，先和用户确认关键参数（尺寸、时长等）。
生成完成后，告知用户视频链接。`,
    tools: ['text_to_video', 'image_to_video', 'poll_video'],
    defaultModel: 'claude-sonnet-5',
  },
  coding: {
    type: 'coding',
    name: '编程助手',
    systemPrompt: `你是一个编程助手。你可以：
1. 使用 read_file 读取文件
2. 使用 write_file 写入文件
3. 使用 list_files 列出目录
4. 使用 run_shell 执行命令

在修改代码前，先读取相关文件了解上下文。
修改后，运行相关测试确保没有破坏现有功能。`,
    tools: ['read_file', 'write_file', 'list_files', 'run_shell'],
    defaultModel: 'claude-sonnet-5',
  },
}

export function getAgentDefinition(type: string): AgentDefinition {
  const def = builtinAgents[type]
  if (!def) {
    return builtinAgents.general
  }
  return def
}

export function listAgentTypes(): AgentDefinition[] {
  return Object.values(builtinAgents)
}
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/agent/registry.ts
git commit -m "feat: add agent type registry with builtin agents"
```

---

### Task 11: SSE 工具函数

**Files:**
- Create: `happyhorse-server/src/lib/sse.ts`

- [ ] **Step 1: 创建 lib/sse.ts**

```typescript
import type { SSEController, SSEHandler } from '../types'

export interface SSEController {
  sendEvent(event: string, data: unknown): void
  close(): void
}

export function sseResponse(handler: (sse: SSEController) => Promise<void>): Response {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sse: SSEController = {
          sendEvent(event: string, data: unknown) {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(payload))
          },
          close() {
            controller.close()
          },
        }

        try {
          await handler(sse)
        } catch (err) {
          sse.sendEvent('error', { error: err instanceof Error ? err.message : '未知错误' })
        } finally {
          sse.close()
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    },
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/lib/sse.ts
git commit -m "feat: add SSE streaming utilities"
```

---

## Phase 6: 内置工具

### Task 12: 视频工具

**Files:**
- Create: `happyhorse-server/src/tools/video.ts`

- [ ] **Step 1: 创建 tools/video.ts**

```typescript
import { toolRegistry } from '../agent/tool-registry'
import type { ToolContext } from '../agent/tool-registry'

function dashscopeClient(apiKey: string) {
  const baseUrl = 'https://dashscope.aliyuncs.com/api/v1'
  return {
    async createTask(model: string, input: Record<string, unknown>, parameters: Record<string, unknown> = {}) {
      const res = await fetch(`${baseUrl}/services/aigc/video-generation/video-synthesis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({ model, input, parameters }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `DashScope API error: ${res.status}`)
      }
      const data = await res.json()
      return data.output
    },
    async queryTask(taskId: string) {
      const res = await fetch(`${baseUrl}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      if (!res.ok) throw new Error(`Query task error: ${res.status}`)
      const data = await res.json()
      return data.output
    },
  }
}

toolRegistry.register({
  name: 'text_to_video',
  description: '使用文本描述生成视频。提交后返回任务ID，需要配合 poll_video 查询进度。',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '视频描述文本' },
      size: { type: 'string', enum: ['1280*720', '720*1280', '960*960'], description: '视频尺寸' },
      duration: { type: 'number', enum: [3, 5, 7, 10], description: '视频时长(秒)' },
    },
    required: ['prompt'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'running' })

    const apiKey = (ctx as any).apiKey || process.env.DASHSCOPE_API_KEY
    const client = dashscopeClient(apiKey)

    const params: Record<string, unknown> = {}
    if (args.size) params.size = args.size
    if (args.duration) params.duration = args.duration

    const output = await client.createTask('happyhorse-1.0-t2v', { prompt: args.prompt }, params)
    const taskId = output.task_id

    ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'polling', message: '任务已提交，等待生成...' })

    // 轮询直到完成
    const terminalStates = ['SUCCEEDED', 'FAILED']
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000))
      const status = await client.queryTask(taskId)

      if (terminalStates.includes(status.task_status)) {
        if (status.task_status === 'SUCCEEDED') {
          const videoUrl = status.video_url || (status.results?.[0]?.url) || ''
          ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'completed', result: { videoUrl, taskId } })
          return { videoUrl, taskId }
        } else {
          const error = status.message || '视频生成失败'
          ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'failed', error })
          return { error, taskId }
        }
      }

      ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'polling', message: `生成中...`, result: { taskId, taskStatus: status.task_status } })
    }
  },
})

toolRegistry.register({
  name: 'image_to_video',
  description: '使用图片生成视频。需要提供图片 URL。提交后返回任务ID，需要配合 poll_video 查询进度。',
  parameters: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string', description: '首帧图片 URL' },
      prompt: { type: 'string', description: '视频运动描述（可选）' },
      size: { type: 'string', enum: ['1280*720', '720*1280', '960*960'], description: '视频尺寸' },
      duration: { type: 'number', enum: [3, 5, 7, 10], description: '视频时长(秒)' },
    },
    required: ['imageUrl'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'running' })

    const apiKey = (ctx as any).apiKey || process.env.DASHSCOPE_API_KEY
    const client = dashscopeClient(apiKey)

    const input: Record<string, unknown> = {
      prompt: args.prompt || '',
      media: [{ type: 'first_frame', url: args.imageUrl }],
    }
    const params: Record<string, unknown> = {}
    if (args.size) params.size = args.size
    if (args.duration) params.duration = args.duration

    const output = await client.createTask('happyhorse-1.0-i2v', input, params)
    const taskId = output.task_id

    ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'polling', message: '任务已提交，等待生成...' })

    const terminalStates = ['SUCCEEDED', 'FAILED']
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000))
      const status = await client.queryTask(taskId)

      if (terminalStates.includes(status.task_status)) {
        if (status.task_status === 'SUCCEEDED') {
          const videoUrl = status.video_url || (status.results?.[0]?.url) || ''
          ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'completed', result: { videoUrl, taskId } })
          return { videoUrl, taskId }
        } else {
          const error = status.message || '视频生成失败'
          ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'failed', error })
          return { error, taskId }
        }
      }

      ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'polling', message: '生成中...', result: { taskId, taskStatus: status.task_status } })
    }
  },
})

toolRegistry.register({
  name: 'poll_video',
  description: '查询视频生成任务的状态',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: '视频任务 ID' },
    },
    required: ['taskId'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'poll_video', status: 'running' })

    const apiKey = (ctx as any).apiKey || process.env.DASHSCOPE_API_KEY
    const client = dashscopeClient(apiKey)
    const status = await client.queryTask(args.taskId)

    ctx.sendEvent({ id: callId, name: 'poll_video', status: 'completed', result: status })
    return status
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/tools/video.ts
git commit -m "feat: add video generation tools (t2v, i2v, poll)"
```

---

### Task 13: 文件工具

**Files:**
- Create: `happyhorse-server/src/tools/file.ts`

- [ ] **Step 1: 创建 tools/file.ts**

```typescript
import { toolRegistry } from '../agent/tool-registry'
import type { ToolContext } from '../agent/tool-registry'
import fs from 'fs/promises'
import path from 'path'

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd()

function resolvePath(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath)
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error('不允许访问工作区外的路径')
  }
  return resolved
}

toolRegistry.register({
  name: 'read_file',
  description: '读取文件内容',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对于工作区根目录）' },
    },
    required: ['path'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'read_file', status: 'running', message: `读取 ${args.path}` })

    try {
      const filePath = resolvePath(args.path as string)
      const content = await fs.readFile(filePath, 'utf-8')
      ctx.sendEvent({ id: callId, name: 'read_file', status: 'completed', result: { path: args.path, content } })
      return { path: args.path, content }
    } catch (err) {
      const error = err instanceof Error ? err.message : '读取失败'
      ctx.sendEvent({ id: callId, name: 'read_file', status: 'failed', error })
      return { error }
    }
  },
})

toolRegistry.register({
  name: 'write_file',
  description: '写入文件内容（会覆盖已有文件）',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对于工作区根目录）' },
      content: { type: 'string', description: '文件内容' },
    },
    required: ['path', 'content'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'write_file', status: 'running', message: `写入 ${args.path}` })

    try {
      const filePath = resolvePath(args.path as string)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, args.content as string, 'utf-8')
      ctx.sendEvent({ id: callId, name: 'write_file', status: 'completed', result: { path: args.path } })
      return { path: args.path, success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : '写入失败'
      ctx.sendEvent({ id: callId, name: 'write_file', status: 'failed', error })
      return { error }
    }
  },
})

toolRegistry.register({
  name: 'list_files',
  description: '列出目录中的文件和文件夹',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '目录路径（相对于工作区根目录，默认为根目录）' },
    },
    required: [],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    const dirPath = args.path ? resolvePath(args.path as string) : WORKSPACE_ROOT
    ctx.sendEvent({ id: callId, name: 'list_files', status: 'running', message: `列出 ${args.path || '/'}` })

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const result = entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }))
      ctx.sendEvent({ id: callId, name: 'list_files', status: 'completed', result })
      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : '列出失败'
      ctx.sendEvent({ id: callId, name: 'list_files', status: 'failed', error })
      return { error }
    }
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/tools/file.ts
git commit -m "feat: add file operation tools (read, write, list)"
```

---

### Task 14: Shell 工具

**Files:**
- Create: `happyhorse-server/src/tools/shell.ts`

- [ ] **Step 1: 创建 tools/shell.ts**

```typescript
import { toolRegistry } from '../agent/tool-registry'
import type { ToolContext } from '../agent/tool-registry'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd()

toolRegistry.register({
  name: 'run_shell',
  description: '执行 shell 命令。注意：仅用于编程相关任务，避免执行危险命令。',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的 shell 命令' },
      timeout: { type: 'number', description: '超时时间（毫秒），默认 30000' },
    },
    required: ['command'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'run_shell', status: 'running', message: `执行: ${args.command}` })

    try {
      const { stdout, stderr } = await execAsync(args.command as string, {
        cwd: WORKSPACE_ROOT,
        timeout: (args.timeout as number) || 30000,
        maxBuffer: 1024 * 1024, // 1MB
      })

      const result = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      }
      ctx.sendEvent({ id: callId, name: 'run_shell', status: 'completed', result })
      return result
    } catch (err: any) {
      const result = {
        stdout: err.stdout?.trim() || '',
        stderr: err.stderr?.trim() || '',
        exitCode: err.code || 1,
        error: err.message,
      }
      ctx.sendEvent({ id: callId, name: 'run_shell', status: 'completed', result })
      return result
    }
  },
})
```

- [ ] **Step 2: 创建 tools/index.ts**

```typescript
import './video'
import './file'
import './shell'
```

- [ ] **Step 3: Commit**

```bash
git add happyhorse-server/src/tools/
git commit -m "feat: add shell execution tool and tools index"
```

---

## Phase 7: Agent 执行器与 Chat 端点

### Task 15: Agent 核心执行器

**Files:**
- Create: `happyhorse-server/src/agent/run.ts`

- [ ] **Step 1: 创建 agent/run.ts**

```typescript
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

  const agentDef = getAgentDefinition(agentType)
  const model = createProvider({
    provider: llmConfig.provider,
    apiKey: llmConfig.apiKey,
    baseUrl: llmConfig.baseUrl,
    model: llmConfig.model,
  })

  const tools = toolRegistry.toVercelTools()

  // 工具上下文：传递 SSE 控制器和 API key
  const toolContext: ToolContext & { apiKey: string } = {
    sessionId,
    apiKey: llmConfig.apiKey,
    sendEvent(event) {
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

  // 重写每个工具的 execute，注入 context
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

  const result = streamText({
    model,
    system: agentDef.systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
    tools: wrappedTools,
  })

  // 处理流式输出
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case 'text-delta':
        sse.sendEvent('text', { text: chunk.textDelta })
        break
      case 'tool-call':
        sse.sendEvent('tool-call', {
          id: chunk.toolCallId,
          name: chunk.toolName,
          args: chunk.args,
        })
        break
      // tool-result 由工具内部的 execute 函数通过 ToolContext 自行推送
    }
  }

  const usage = await result.usage
  const finalText = await result.text

  sse.sendEvent('done', {
    usage: {
      inputTokens: usage?.promptTokens || 0,
      outputTokens: usage?.completionTokens || 0,
    },
  })

  return { text: finalText, usage }
}
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/agent/run.ts
git commit -m "feat: add agent executor with streaming and tool calling"
```

---

### Task 16: Chat SSE 端点

**Files:**
- Create: `happyhorse-server/src/routes/chat.ts`

- [ ] **Step 1: 创建 routes/chat.ts**

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../db'
import { messages, sessions, llmConfigs } from '../db/schema'
import { eq } from 'drizzle-orm'
import { optionalAuth } from '../lib/auth'
import { sseResponse } from '../lib/sse'
import { runAgent } from '../agent/run'
import '../tools' // 注册工具

const chat = new Hono()

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
  const sessionId = c.req.param('id')
  const body = await c.req.json()
  const parsed = chatSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400)
  }

  const { message, llmConfigId, llmConfig: localConfig } = parsed.data

  // 加载会话
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1)
  if (!session) {
    return c.json({ error: '会话不存在' }, 404)
  }

  // 确定 LLM 配置
  let llmConfig: { provider: string; apiKey: string; baseUrl?: string; model: string }
  if (localConfig) {
    llmConfig = localConfig
  } else {
    const user = c.get('user')
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
        return c.json({ error: 'LLM 配置不存在' }, 404)
      }
    } else if (user) {
      // 用默认配置
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
        return c.json({ error: '请先配置 LLM' }, 400)
      }
    } else {
      return c.json({ error: '请提供 LLM 配置或登录' }, 400)
    }
  }

  // 保存用户消息
  await db.insert(messages).values({
    sessionId,
    role: 'user',
    content: message,
  })

  // 加载历史消息
  const history = await db.select()
    .from(messages)
    .where(eq(messages.sessionId, sessionId))
    .orderBy(messages.createdAt)

  const historyMessages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.content || '' }))

  // 更新会话标题（用第一条用户消息）
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

    // 保存 assistant 消息
    const assistantContent = result.text || ''
    await db.insert(messages).values({
      sessionId,
      role: 'assistant',
      content: assistantContent,
    })

    // 更新会话时间
    await db.update(sessions).set({ updatedAt: new Date() }).where(eq(sessions.id, sessionId))
  })
})

export default chat
```

- [ ] **Step 2: Commit**

```bash
git add happyhorse-server/src/routes/chat.ts
git commit -m "feat: add chat SSE endpoint with agent execution"
```

---

## Phase 8: 应用入口与组装

### Task 17: 应用入口与路由组装

**Files:**
- Create: `happyhorse-server/src/app.ts`
- Create: `happyhorse-server/src/index.ts`

- [ ] **Step 1: 创建 app.ts**

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import auth from './routes/auth'
import configs from './routes/configs'
import projects from './routes/projects'
import sessions from './routes/sessions'
import chat from './routes/chat'

const app = new Hono()

app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  maxAge: 86400,
}))

app.route('/api/auth', auth)
app.route('/api/configs', configs)
app.route('/api', projects)
app.route('/api', sessions)
app.route('/api', chat)

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }))

export default app
```

- [ ] **Step 2: 创建 index.ts**

```typescript
import { serve } from '@hono/node-server'
import app from './app'

const port = parseInt(process.env.PORT || '3000', 10)

console.log(`🚀 HappyHorse Server starting on http://localhost:${port}`)
serve({ fetch: app.fetch, port })
```

- [ ] **Step 3: 安装 @hono/node-server**

```bash
cd happyhorse-server && npm install @hono/node-server
```

- [ ] **Step 4: 更新 package.json 添加 @hono/node-server 依赖**

在 `dependencies` 中添加：
```json
"@hono/node-server": "^1.0.0"
```

- [ ] **Step 5: 验证服务启动**

```bash
cd happyhorse-server && npm run dev
```

Expected: 服务启动在 3000 端口，`GET /api/health` 返回 `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add happyhorse-server/src/app.ts happyhorse-server/src/index.ts happyhorse-server/package.json
git commit -m "feat: add app entry point and route assembly"
```

---

## Phase 9: 前端集成（最小）

### Task 18: 前端 Agent 页面基础框架

**Files:**
- Modify: `happyhorse-app/src/App.vue`
- Create: `happyhorse-app/src/views/AgentChat.vue`
- Modify: `happyhorse-app/src/router/index.js`

- [ ] **Step 1: 更新 App.vue 导航栏，添加 Agent 和设置入口**

找到导航栏部分，修改为：

```html
<nav class="top-nav">
  <router-link to="/" class="nav-link" active-class="active" exact>
    🎬 视频生成
  </router-link>
  <router-link to="/files" class="nav-link" active-class="active">
    📂 文件浏览
  </router-link>
  <router-link to="/agent" class="nav-link" active-class="active">
    🤖 Agent
  </router-link>
  <router-link to="/settings" class="nav-link" active-class="active">
    ⚙️ 设置
  </router-link>
</nav>
```

- [ ] **Step 2: 创建 AgentChat.vue**

```vue
<template>
  <div class="agent-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <select v-model="currentAgentType" class="agent-select">
          <option value="general">🤖 通用助手</option>
          <option value="video">🎬 视频专家</option>
          <option value="coding">💻 编程助手</option>
        </select>
        <button class="btn-new-session" @click="newSession">+ 新会话</button>
      </div>
      <div class="session-list">
        <div
          v-for="s in sessions"
          :key="s.id"
          :class="['session-item', { active: s.id === currentSessionId }]"
          @click="selectSession(s)"
        >
          {{ s.title || '新会话' }}
        </div>
      </div>
    </aside>

    <main class="chat-area">
      <div class="messages" ref="messagesContainer">
        <div v-for="(msg, i) in displayMessages" :key="i" :class="['message', msg.role]">
          <template v-if="msg.role === 'user'">
            <div class="msg-content">{{ msg.content }}</div>
          </template>
          <template v-else-if="msg.role === 'assistant'">
            <div class="msg-content">{{ msg.content }}</div>
          </template>
          <template v-else-if="msg.role === 'tool-call'">
            <div class="tool-card" :class="'tool-' + (msg.status || 'pending')">
              <div class="tool-header">
                <span class="tool-icon">{{ toolIcon(msg.status) }}</span>
                <span class="tool-name">{{ msg.name }}</span>
                <span class="tool-status">{{ msg.status }}</span>
              </div>
              <div v-if="msg.args" class="tool-args">
                <pre>{{ JSON.stringify(msg.args, null, 2) }}</pre>
              </div>
              <div v-if="msg.message" class="tool-message">{{ msg.message }}</div>
              <div v-if="msg.error" class="tool-error">{{ msg.error }}</div>
            </div>
          </template>
        </div>
        <div v-if="streaming" class="streaming-indicator">●</div>
      </div>

      <div class="input-area">
        <textarea
          v-model="inputMessage"
          @keydown.enter.exact.prevent="sendMessage"
          placeholder="输入消息..."
          rows="2"
        ></textarea>
        <button :disabled="!canSend" @click="sendMessage">发送</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'

const BASE_URL = 'http://localhost:3000/api'

const sessions = ref([])
const currentSessionId = ref(null)
const currentAgentType = ref('general')
const inputMessage = ref('')
const streaming = ref(false)
const displayMessages = ref([])
const messagesContainer = ref(null)

const canSend = computed(() => inputMessage.value.trim() && !streaming.value)

function toolIcon(status) {
  const map = { pending: '⏳', running: '🔄', polling: '🔄', completed: '✅', failed: '❌' }
  return map[status] || '⏳'
}

function newSession() {
  // 简化：创建本地会话，后续接入后端 API
  currentSessionId.value = crypto.randomUUID()
  sessions.value.push({ id: currentSessionId.value, title: '新会话', agentType: currentAgentType.value })
  displayMessages.value = []
}

async function selectSession(s) {
  currentSessionId.value = s.id
  currentAgentType.value = s.agentType || 'general'
  // TODO: 从后端加载消息历史
}

async function sendMessage() {
  if (!canSend.value) return

  const message = inputMessage.value.trim()
  inputMessage.value = ''

  displayMessages.value.push({ role: 'user', content: message })

  streaming.value = true
  const assistantMsg = { role: 'assistant', content: '' }
  displayMessages.value.push(assistantMsg)

  try {
    const response = await fetch(`${BASE_URL}/sessions/${currentSessionId.value}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        llmConfig: {
          provider: 'anthropic',
          apiKey: localStorage.getItem('happyhorse_api_key') || '',
          model: 'claude-sonnet-5',
        },
      }),
    })

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          const eventType = line.slice(7).trim()
          const dataLine = lines[lines.indexOf(line) + 1]
          if (dataLine?.startsWith('data: ')) {
            try {
              const data = JSON.parse(dataLine.slice(6))
              handleSSEEvent(eventType, data, assistantMsg)
            } catch {}
          }
        }
      }
    }
  } catch (err) {
    assistantMsg.content = '请求失败: ' + err.message
  } finally {
    streaming.value = false
  }

  await nextTick()
  scrollToBottom()
}

function handleSSEEvent(event, data, assistantMsg) {
  switch (event) {
    case 'text':
      assistantMsg.content += data.text
      break
    case 'tool-call':
      displayMessages.value.push({
        role: 'tool-call',
        id: data.id,
        name: data.name,
        args: data.args,
        status: 'pending',
      })
      break
    case 'tool-start':
      updateToolMessage(data.id, { status: 'running' })
      break
    case 'tool-progress':
      updateToolMessage(data.id, { status: 'polling', message: data.message })
      break
    case 'tool-result':
      updateToolMessage(data.id, { status: 'completed', result: data.result })
      break
    case 'tool-error':
      updateToolMessage(data.id, { status: 'failed', error: data.error })
      break
    case 'done':
      break
  }
}

function updateToolMessage(id, updates) {
  const msg = displayMessages.value.find(m => m.id === id)
  if (msg) Object.assign(msg, updates)
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}
</script>

<style scoped>
.agent-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  height: calc(100vh - 120px);
  gap: 16px;
}

.sidebar {
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sidebar-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agent-select, .btn-new-session {
  width: 100%;
  padding: 8px 12px;
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  color: #f0f0f0;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn-new-session {
  background: #2a2a2a;
  border-color: #444;
}

.btn-new-session:hover { background: #3a3a3a; }

.session-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item:hover { background: #2a2a2a; color: #ddd; }
.session-item.active { background: #3a3a3a; color: #fff; }

.chat-area {
  display: flex;
  flex-direction: column;
  background: #1a1a1a;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message.user .msg-content {
  background: #2a2a2a;
  padding: 10px 14px;
  border-radius: 10px;
  align-self: flex-end;
  max-width: 80%;
}

.message.assistant .msg-content {
  color: #ddd;
  line-height: 1.5;
}

.tool-card {
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.tool-name { font-weight: 600; color: #ccc; }
.tool-status { font-size: 0.8rem; color: #888; }

.tool-args pre {
  background: #0a0a0a;
  padding: 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #aaa;
  overflow-x: auto;
}

.tool-message { font-size: 0.85rem; color: #999; margin-top: 4px; }
.tool-error { font-size: 0.85rem; color: #cc4444; margin-top: 4px; }

.tool-completed { border-color: #3a8; }
.tool-failed { border-color: #c44; }
.tool-running, .tool-polling { border-color: #999; }

.streaming-indicator {
  color: #999;
  animation: blink 1s infinite;
}

@keyframes blink { 50% { opacity: 0; } }

.input-area {
  display: flex;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #333;
  background: #111;
}

.input-area textarea {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px;
  color: #f0f0f0;
  font-size: 0.9rem;
  resize: none;
  outline: none;
  font-family: inherit;
}

.input-area textarea:focus { border-color: #999; }

.input-area button {
  padding: 10px 20px;
  background: #444;
  border: none;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-weight: 600;
}

.input-area button:disabled { opacity: 0.4; cursor: not-allowed; }
.input-area button:not(:disabled):hover { background: #555; }
</style>
```

- [ ] **Step 3: 更新 router/index.js**

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import VideoGenerator from '../views/VideoGenerator.vue'
import FileBrowser from '../views/FileBrowser.vue'
import AgentChat from '../views/AgentChat.vue'

const routes = [
  { path: '/', name: 'video', component: VideoGenerator },
  { path: '/files', name: 'files', component: FileBrowser },
  { path: '/agent', name: 'agent', component: AgentChat },
]

const router = createRouter({
  history: createWebHistory('/testpage/'),
  routes,
})

export default router
```

- [ ] **Step 4: Commit**

```bash
git add happyhorse-app/src/App.vue happyhorse-app/src/views/AgentChat.vue happyhorse-app/src/router/index.js
git commit -m "feat: add agent chat page with SSE streaming"
```

---

## 验证清单

完成所有 Task 后，按以下步骤验证：

1. **启动后端**：`cd happyhorse-server && npm run dev` → 3000 端口
2. **健康检查**：`curl http://localhost:3000/api/health` → `{"status":"ok"}`
3. **注册用户**：`POST /api/auth/register` → 返回 token
4. **配置 LLM**：`POST /api/configs/llm` → 创建 LLM 配置
5. **创建项目**：`POST /api/projects` → 创建项目
6. **创建会话**：`POST /api/projects/:id/sessions` → 创建会话
7. **发送消息**：`POST /api/sessions/:id/chat` → SSE 流式返回
8. **前端联调**：启动前端，进入 Agent 页面，发送消息，观察 SSE 流式渲染