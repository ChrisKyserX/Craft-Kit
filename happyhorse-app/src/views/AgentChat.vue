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
import { ref, computed, nextTick, onMounted } from 'vue'

const BASE_URL = 'http://localhost:3000/api'
const TOKEN_KEY = 'hh_token'

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' }
}

const sessions = ref([])
const currentSessionId = ref(null)
const currentProjectId = ref(null)
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

onMounted(async () => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return
  try {
    const projRes = await fetch(`${BASE_URL}/projects`, { headers: authHeaders() })
    if (projRes.ok) {
      const projList = await projRes.json()
      if (projList.length > 0) {
        currentProjectId.value = projList[0].id
        const sessRes = await fetch(`${BASE_URL}/projects/${currentProjectId.value}/sessions`, { headers: authHeaders() })
        if (sessRes.ok) {
          sessions.value = await sessRes.json()
        }
      }
    }
  } catch {}
})

async function selectSession(s) {
  currentSessionId.value = s.id
  currentAgentType.value = s.agentType || 'general'
  try {
    const res = await fetch(`${BASE_URL}/sessions/${s.id}/messages`, { headers: authHeaders() })
    if (res.ok) {
      const msgs = await res.json()
      displayMessages.value = msgs.map(m => ({
        role: m.role,
        content: m.content,
      }))
    }
  } catch {}
}

async function newSession() {
  try {
    // 创建默认项目（如果还没有）
    if (!currentProjectId.value) {
      const projRes = await fetch(`${BASE_URL}/projects`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: '默认项目' }),
      })
      if (projRes.ok) {
        const proj = await projRes.json()
        currentProjectId.value = proj.id
      } else {
        const err = await projRes.json().catch(() => ({}))
        alert('创建项目失败：' + (err.error || '请先在设置页登录'))
        return
      }
    }

    // 在后端创建会话
    const res = await fetch(`${BASE_URL}/projects/${currentProjectId.value}/sessions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ agentType: currentAgentType.value }),
    })
    if (res.ok) {
      const session = await res.json()
      currentSessionId.value = session.id
      sessions.value.push(session)
      displayMessages.value = []
    } else {
      const err = await res.json().catch(() => ({}))
      alert('创建会话失败：' + (err.error || '未知错误'))
    }
  } catch (err) {
    console.error('Failed to create session:', err)
    alert('创建会话失败，请检查后端是否启动')
  }
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
    // 已登录用户使用后端配置，未登录用本地配置
    const token = localStorage.getItem(TOKEN_KEY)
    let body
    if (token) {
      body = JSON.stringify({ message })
    } else {
      body = JSON.stringify({
        message,
        llmConfig: {
          provider: 'anthropic',
          apiKey: localStorage.getItem('happyhorse_api_key') || '',
          model: 'claude-sonnet-5',
        },
      })
    }

    const response = await fetch(`${BASE_URL}/sessions/${currentSessionId.value}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body,
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || `请求失败 (${response.status})`)
    }

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
    case 'error':
      assistantMsg.content = '❌ ' + (data.error || '请求失败')
      streaming.value = false
      break
    case 'done':
      streaming.value = false
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