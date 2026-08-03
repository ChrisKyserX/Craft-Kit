# HappyHorse Server — Agent 后端设计文档

> 日期：2026-08-03
> 状态：设计完成，待实现

## 1. 概述

在 Craft-Kit 根目录新建 `happyhorse-server/`，作为 HappyHorse 前端的 Agent 后端。核心目标：

- **API 代理**：将 DashScope、COS 等外部 API 调用收到后端，前端不再暴露密钥
- **Agent 编排**：支持多专家 Agent（视频、Coding、通用），LLM 自主调用工具完成任务
- **流式输出**：SSE 实时推送思考过程、工具调用、执行结果
- **多模型支持**：用户可通过 Web 界面自行配置 LLM provider 和 API Key
- **账号体系**：支持登录后云端存储配置，也支持不登录的本地模式

### 技术栈

| 层 | 选型 |
|---|---|
| 运行时 | Node.js + TypeScript |
| HTTP 框架 | Hono |
| Agent 引擎 | Vercel AI SDK |
| 数据库 | PostgreSQL（云数据库，已有） |
| ORM | Drizzle ORM |
| 认证 | better-auth |
| 前端 | Vue 3 + Vite（已有 happyhorse-app） |

### 不在首期范围

- Skill 系统（留扩展点，后续接入）
- MCP 集成（留扩展点，后续接入）

---

## 2. 项目结构

```
Craft-Kit/
├── happyhorse-app/              # 前端 (已存在)
└── happyhorse-server/           # 后端 (新建)
    ├── package.json
    ├── tsconfig.json
    ├── .env                     # DATABASE_URL, JWT_SECRET
    ├── drizzle.config.ts
    ├── src/
    │   ├── index.ts                 # 入口，启动 Hono server
    │   ├── app.ts                   # Hono 实例，挂载路由
    │   ├── db/
    │   │   ├── index.ts             # Drizzle 连接池 + 迁移
    │   │   └── schema.ts            # 表定义
    │   ├── routes/
    │   │   ├── auth.ts              # 注册/登录/me
    │   │   ├── configs.ts           # LLM 配置 CRUD
    │   │   ├── projects.ts          # 项目 CRUD
    │   │   ├── sessions.ts          # 会话 CRUD + 消息历史
    │   │   └── chat.ts              # POST /sessions/:id/chat (SSE)
    │   ├── agent/
    │   │   ├── registry.ts          # Agent 类型注册中心
    │   │   ├── tool-registry.ts     # 工具注册中心
    │   │   └── run.ts               # 核心 agent 执行 (streamText)
    │   ├── tools/                   # 内置工具实现
    │   │   ├── index.ts             # 工具注册入口
    │   │   ├── video.ts             # 视频生成工具 (t2v, i2v, poll)
    │   │   ├── file.ts              # 文件操作工具 (read, write, list)
    │   │   └── shell.ts             # Shell 执行工具 (coding agent)
    │   └── lib/
    │       ├── llm.ts               # AI SDK provider 工厂
    │       └── sse.ts               # SSE 流式响应工具
    └── skills/                      # 内置 skill 定义 (未来扩展)
```

---

## 3. 数据库 Schema

### 用户 & 认证

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100),
  created_at    TIMESTAMP DEFAULT now()
);
```

### LLM 配置

```sql
CREATE TABLE llm_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,          -- 显示名称，如 "我的Claude"
  provider      VARCHAR(50) NOT NULL,           -- openai | anthropic | deepseek | dashscope
  api_key       TEXT NOT NULL,                  -- 明文存储
  base_url      VARCHAR(255),                   -- 可选，自建代理地址
  default_model VARCHAR(100) NOT NULL,          -- 如 "claude-sonnet-5"
  is_default    BOOLEAN DEFAULT false,
  created_at    TIMESTAMP DEFAULT now()
);
```

### 项目

```sql
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);
```

### 会话

```sql
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  title         VARCHAR(300),
  agent_type    VARCHAR(50) NOT NULL DEFAULT 'general',  -- video | coding | general
  status        VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | archived
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);
```

### 消息

```sql
CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  role          VARCHAR(20) NOT NULL,            -- user | assistant | tool | system
  content       TEXT,                            -- 文本内容
  tool_calls    JSONB,                           -- [{id, name, args, status, result, error}]
  created_at    TIMESTAMP DEFAULT now()
);
```

### Agent 配置

```sql
CREATE TABLE agent_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  agent_type    VARCHAR(50) NOT NULL,            -- video | coding | general
  system_prompt TEXT NOT NULL,
  model         VARCHAR(100) NOT NULL,
  llm_config_id UUID REFERENCES llm_configs(id),
  tools         JSONB DEFAULT '[]',              -- 启用的工具列表
  is_default    BOOLEAN DEFAULT false,
  created_at    TIMESTAMP DEFAULT now()
);
```

### 设计决策

- `messages.tool_calls` 用 JSONB 存储完整的工具调用生命周期（含参数、状态变化、结果），一条消息可包含多次工具调用
- `agent_configs` 允许用户自定义每种 agent 的 system prompt、model、工具集
- 内置 agent 模板（video、coding、general）作为默认配置，用户可基于模板修改

---

## 4. Agent 引擎

### 架构

```
POST /api/sessions/:id/chat  (SSE)
        │
        ▼
┌──────────────────────────────────────────────┐
│  run.ts  (agent 执行器)                       │
│                                              │
│  1. 加载 AgentConfig (system prompt + tools)  │
│  2. 加载历史消息 → 组装 messages[]            │
│  3. 组装 tools = 内置工具集                   │
│  4. streamText() → SSE 逐事件推送             │
│  5. 完成后保存消息到数据库                    │
└──────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│  Tool Registry                               │
│                                              │
│  ┌──────────────┐  ┌──────────────┐          │
│  │ 视频工具       │  │ 文件工具       │  ...    │
│  │ - t2v         │  │ - read_file   │          │
│  │ - i2v         │  │ - write_file  │          │
│  │ - poll_video  │  │ - list_files  │          │
│  └──────────────┘  └──────────────┘          │
│                                              │
│  ┌──────────────┐                            │
│  │ Shell 工具     │  (coding agent 专用)       │
│  │ - run_shell   │                            │
│  └──────────────┘                            │
└──────────────────────────────────────────────┘
```

### 工具执行生命周期

```
model 决定调用 → pending (tool-call) → running (tool-start)
                                              │
                    ┌─────────────────────────┼──────────────────┐
                    │                         │                  │
                    ▼                         ▼                  ▼
               completed                  failed            cancelled
              (tool-result)            (tool-error)
                    │
              [异步工具额外]
                    │
              polling → polling → ... → completed
            (tool-progress 事件，可多次)
```

### 异步工具处理

对于视频生成等耗时操作，工具内部分两步：

1. `create_video` 工具 → 提交任务到 DashScope → 立即返回 `taskId`，状态标记为 `polling`
2. 工具内部启动轮询循环，每次轮询推送 `tool-progress` 事件
3. 任务完成后推送 `tool-result`

Agent 在等待异步工具完成期间不阻塞，轮询在工具内部进行。

### Agent 类型

| 类型 | system prompt | 工具集 | 说明 |
|------|--------------|--------|------|
| `general` | 通用助手 | 文件、视频、HTTP | 默认 |
| `video` | 视频生成专家 | 视频全套 | 专注视频生成 |
| `coding` | 编程助手 | 文件、Shell | 可读写代码、执行命令 |

---

## 5. API 设计

### 路由总览

```
认证
POST   /api/auth/register       注册 {email, password, name?}
POST   /api/auth/login          登录 {email, password} → {token, user}
GET    /api/auth/me             当前用户信息

LLM 配置（需登录）
GET    /api/configs/llm         获取配置列表
POST   /api/configs/llm         新增 {name, provider, api_key, base_url?, default_model, is_default?}
PUT    /api/configs/llm/:id     修改
DELETE /api/configs/llm/:id     删除

项目
GET    /api/projects            项目列表
POST   /api/projects            创建 {name, description?}
PUT    /api/projects/:id        修改
DELETE /api/projects/:id        删除

会话
GET    /api/projects/:id/sessions      会话列表
POST   /api/projects/:id/sessions      创建 {title?, agent_type?}
PUT    /api/sessions/:id               修改
DELETE /api/sessions/:id               删除
GET    /api/sessions/:id/messages      消息历史

聊天（核心）
POST   /api/sessions/:id/chat          SSE 流式响应
```

### Chat 请求

```json
POST /api/sessions/:id/chat

// 已登录用户
{
  "message": "帮我生成一个赛博朋克风格的机械马视频",
  "llm_config_id": "uuid"       // 可选，不传则用默认配置
}

// 未登录（本地模式）
{
  "message": "帮我生成一个...",
  "llm_config": {
    "provider": "anthropic",
    "api_key": "sk-xxx",
    "model": "claude-sonnet-5",
    "base_url": "https://api.anthropic.com/v1"  // 可选
  }
}
```

### SSE 事件类型

```
Content-Type: text/event-stream

# 思考内容
event: thinking
data: {"text": "让我分析一下这个需求..."}

# 模型决定调用工具
event: tool-call
data: {"id":"call_1","name":"text_to_video","args":{"prompt":"赛博朋克机械马","size":"1280*720"}}

# 工具开始执行
event: tool-start
data: {"id":"call_1","name":"text_to_video","status":"running"}

# 工具执行进度（异步工具可多次推送）
event: tool-progress
data: {"id":"call_1","name":"text_to_video","status":"polling","message":"生成中 60%...","taskId":"abc123"}

# 工具执行完成
event: tool-result
data: {"id":"call_1","name":"text_to_video","status":"completed","result":{"videoUrl":"https://..."}}

# 工具执行失败
event: tool-error
data: {"id":"call_1","name":"text_to_video","status":"failed","error":"API Key 无效"}

# 文本回复
event: text
data: {"text": "视频已生成完成！"}

# 流结束
event: done
data: {"usage":{"input_tokens":200,"output_tokens":500}}
```

### 认证方式

- 登录后返回 JWT token
- 前端存入 localStorage
- 请求头 `Authorization: Bearer <token>`
- 未登录请求不携带 token，后端按本地模式处理

---

## 6. 前端新页面

基于现有两页（视频生成、文件浏览），新增：

```
导航：🎬 视频生成 | 📂 文件浏览 | 🤖 Agent | ⚙️ 设置
```

### Agent 页面（经典 Chat 布局）

- 左侧：会话列表 + Agent 类型切换 + 项目选择器
- 右侧：消息区域（SSE 实时渲染）+ 底部输入框
- 消息渲染：用户消息、AI 思考（thinking 事件）、工具调用卡片（带状态动画）、最终文本回复

### 设置页面

- 账号区块：登录/注册表单，或已登录状态 + 退出
- LLM 配置区块：provider 列表（增删改），设置默认
- 本地模式：未登录时配置存 localStorage，登录后可选同步到云端

> 注：前端页面细节后续迭代优化，以上为初始设计方向。

---

## 7. 环境变量

```bash
# .env
DATABASE_URL=postgresql://user:password@host:5432/happyhorse
JWT_SECRET=xxx
PORT=3000
```

---

## 8. 扩展预留

以下模块不在首期，但架构上预留了扩展点：

- **Skill 系统**：`skills/` 目录 + `SkillManager` 类，加载 Markdown 定义的 skill，注入 system prompt 和工具
- **MCP 集成**：`mcp-client.ts`，连接 MCP server，注册外部工具到 Tool Registry
- **多模型路由**：`llm.ts` 工厂已支持多 provider，新增 provider 一行配置即可