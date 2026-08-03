<template>
  <div class="settings-page">
    <h2>⚙️ 设置</h2>

    <!-- 账号区块 -->
    <section class="section">
      <h3>账号</h3>
      <div v-if="user" class="user-info">
        <span>👤 {{ user.email }}</span>
        <button class="btn" @click="logout">退出登录</button>
      </div>
      <div v-else class="auth-form">
        <div class="form-tabs">
          <button :class="{ active: authMode === 'login' }" @click="authMode = 'login'">登录</button>
          <button :class="{ active: authMode === 'register' }" @click="authMode = 'register'">注册</button>
        </div>
        <input v-model="authForm.email" type="email" placeholder="邮箱" />
        <input v-model="authForm.password" type="password" placeholder="密码" />
        <input v-if="authMode === 'register'" v-model="authForm.name" placeholder="昵称（可选）" />
        <button class="btn btn-primary" @click="handleAuth" :disabled="authLoading">
          {{ authLoading ? '处理中...' : (authMode === 'login' ? '登录' : '注册') }}
        </button>
        <div v-if="authError" class="error">{{ authError }}</div>
      </div>
    </section>

    <!-- LLM 配置区块 -->
    <section class="section">
      <h3>LLM 配置</h3>
      <div v-if="!user" class="hint">登录后可以保存 LLM 配置到云端</div>
      <div class="config-list">
        <div v-for="cfg in configs" :key="cfg.id" class="config-card">
          <div class="config-header">
            <span class="config-name">{{ cfg.name }}</span>
            <span class="config-provider">{{ cfg.provider }}</span>
            <span class="config-model">{{ cfg.defaultModel }}</span>
            <button class="btn-small" @click="editConfig(cfg)">编辑</button>
            <button class="btn-small btn-danger" @click="deleteConfig(cfg.id)">删除</button>
          </div>
        </div>
      </div>
      <button class="btn" @click="showAddConfig = true">+ 新增配置</button>

      <!-- 新增/编辑配置弹窗 -->
      <div v-if="showAddConfig" class="modal-overlay" @click.self="showAddConfig = false">
        <div class="modal">
          <h4>{{ editingConfig ? '编辑' : '新增' }} LLM 配置</h4>
          <input v-model="configForm.name" placeholder="名称（如：我的Claude）" />
          <select v-model="configForm.provider">
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="deepseek">DeepSeek</option>
            <option value="dashscope">DashScope</option>
          </select>
          <input v-model="configForm.apiKey" type="password" placeholder="API Key" />
          <input v-model="configForm.baseUrl" placeholder="Base URL（可选）" />
          <input v-model="configForm.defaultModel" placeholder="默认模型（如：claude-sonnet-5）" />
          <div class="modal-actions">
            <button class="btn btn-test" @click="testConnection" :disabled="testLoading">
              {{ testLoading ? '测试中...' : '🔗 测试连接' }}
            </button>
            <button class="btn btn-primary" @click="saveConfig" :disabled="configLoading">
              {{ configLoading ? '保存中...' : '保存' }}
            </button>
            <button class="btn" @click="showAddConfig = false">取消</button>
          </div>
          <div v-if="testResult" :class="['test-result', testResult.ok ? 'test-ok' : 'test-fail']">
            {{ testResult.msg }}
          </div>
          <div v-if="configError" class="error">{{ configError }}</div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const BASE_URL = 'http://localhost:3000/api'
const TOKEN_KEY = 'hh_token'

const user = ref(null)
const authMode = ref('login')
const authLoading = ref(false)
const authError = ref('')
const authForm = reactive({ email: '', password: '', name: '' })

const configs = ref([])
const showAddConfig = ref(false)
const editingConfig = ref(null)
const configLoading = ref(false)
const configError = ref('')
const testLoading = ref(false)
const testResult = ref(null)
const configForm = reactive({ name: '', provider: 'anthropic', apiKey: '', baseUrl: '', defaultModel: '' })

function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
}

async function handleAuth() {
  authLoading.value = true
  authError.value = ''
  try {
    const endpoint = authMode.value === 'login' ? '/auth/login' : '/auth/register'
    const body = { email: authForm.email, password: authForm.password }
    if (authMode.value === 'register' && authForm.name) body.name = authForm.name

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '请求失败')

    setToken(data.token)
    user.value = data.user
    authForm.email = ''
    authForm.password = ''
    authForm.name = ''
    loadConfigs()
  } catch (err) {
    authError.value = err.message
  } finally {
    authLoading.value = false
  }
}

function logout() {
  clearToken()
  user.value = null
  configs.value = []
}

async function loadConfigs() {
  if (!getToken()) return
  try {
    const res = await fetch(`${BASE_URL}/configs/llm`, { headers: authHeaders() })
    if (res.ok) configs.value = await res.json()
  } catch {}
}

async function saveConfig() {
  configLoading.value = true
  configError.value = ''
  try {
    const url = editingConfig.value
      ? `${BASE_URL}/configs/llm/${editingConfig.value.id}`
      : `${BASE_URL}/configs/llm`
    const method = editingConfig.value ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: authHeaders(),
      body: JSON.stringify(configForm),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '保存失败')

    showAddConfig.value = false
    editingConfig.value = null
    resetConfigForm()
    loadConfigs()
  } catch (err) {
    configError.value = err.message
  } finally {
    configLoading.value = false
  }
}

function editConfig(cfg) {
  editingConfig.value = cfg
  configForm.name = cfg.name
  configForm.provider = cfg.provider
  configForm.apiKey = cfg.apiKey
  configForm.baseUrl = cfg.baseUrl || ''
  configForm.defaultModel = cfg.defaultModel
  showAddConfig.value = true
}

async function deleteConfig(id) {
  if (!confirm('确认删除？')) return
  await fetch(`${BASE_URL}/configs/llm/${id}`, { method: 'DELETE', headers: authHeaders() })
  loadConfigs()
}

async function testConnection() {
  testLoading.value = true
  testResult.value = null
  try {
    const res = await fetch(`${BASE_URL}/configs/llm/test`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        provider: configForm.provider,
        apiKey: configForm.apiKey,
        baseUrl: configForm.baseUrl || undefined,
        model: configForm.defaultModel,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      testResult.value = { ok: true, msg: '连接成功！模型: ' + (data.model || configForm.defaultModel) }
    } else {
      testResult.value = { ok: false, msg: '连接失败: ' + (data.error || '未知错误') }
    }
  } catch (err) {
    testResult.value = { ok: false, msg: '连接失败: ' + err.message }
  } finally {
    testLoading.value = false
  }
}

function resetConfigForm() {
  configForm.name = ''
  configForm.provider = 'anthropic'
  configForm.apiKey = ''
  configForm.baseUrl = ''
  configForm.defaultModel = ''
}

onMounted(async () => {
  const token = getToken()
  if (token) {
    try {
      const res = await fetch(`${BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        user.value = await res.json()
        loadConfigs()
      } else {
        clearToken()
      }
    } catch {}
  }
})
</script>

<style scoped>
.settings-page {
  max-width: 600px;
  margin: 0 auto;
}

h2 { margin-bottom: 24px; color: #f0f0f0; }

.section {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.section h3 { margin-bottom: 16px; font-size: 1rem; color: #ccc; }

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #ddd;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 4px;
}

.form-tabs button {
  flex: 1;
  padding: 8px;
  background: #111;
  border: 1px solid #333;
  border-radius: 6px;
  color: #999;
  cursor: pointer;
}

.form-tabs button.active {
  background: #3a3a3a;
  color: #fff;
  border-color: #555;
}

input, select {
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #f0f0f0;
  font-size: 0.9rem;
  outline: none;
  font-family: inherit;
}

input:focus, select:focus { border-color: #999; }

.btn {
  padding: 8px 16px;
  background: #3a3a3a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #ddd;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn:hover { background: #555; }
.btn-primary { background: #444; color: #fff; }
.btn-primary:hover { background: #555; }
.btn-small { padding: 4px 10px; font-size: 0.8rem; }
.btn-danger { color: #c44; border-color: #633; }
.btn-test { background: #2a4a2a; border-color: #3a6a3a; color: #8c8; }
.btn-test:hover { background: #3a5a3a; }

.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.error { color: #cc4444; font-size: 0.85rem; }
.test-result { margin-top: 8px; padding: 8px; border-radius: 6px; font-size: 0.85rem; }
.test-ok { background: #1a2a1a; color: #8c8; border: 1px solid #3a6a3a; }
.test-fail { background: #2a1a1a; color: #c88; border: 1px solid #6a3a3a; }
.hint { color: #888; font-size: 0.85rem; margin-bottom: 12px; }

.config-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.config-card {
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.config-name { color: #ddd; font-weight: 600; }
.config-provider { color: #999; font-size: 0.8rem; }
.config-model { color: #888; font-size: 0.8rem; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: #1a1a1a;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  padding: 24px;
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal h4 { color: #ddd; margin: 0; }

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>