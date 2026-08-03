<template>
  <div class="panel">
    <div class="form-section">
      <div class="form-group">
        <label>提示词 (Prompt)</label>
        <textarea
          v-model="form.prompt"
          rows="3"
          placeholder="描述你想要生成的视频内容，例如：一只机械马在未来城市街道上奔跑，电影感镜头，赛博朋克风格"
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>分辨率</label>
          <select v-model="form.resolution">
            <option value="">默认</option>
            <option value="720P">720P</option>
            <option value="1080P">1080P</option>
          </select>
        </div>
        <div class="form-group">
          <label>尺寸</label>
          <select v-model="form.size">
            <option value="">默认</option>
            <option value="1280*720">1280×720 (16:9)</option>
            <option value="720*1280">720×1280 (9:16)</option>
            <option value="960*960">960×960 (1:1)</option>
            <option value="1920*1080">1920×1080 (16:9)</option>
          </select>
        </div>
        <div class="form-group">
          <label>时长 (秒)</label>
          <select v-model="form.duration">
            <option value="">默认(5)</option>
            <option :value="3">3</option>
            <option :value="5">5</option>
            <option :value="7">7</option>
            <option :value="10">10</option>
          </select>
        </div>
      </div>

      <button class="btn-primary" :disabled="!canSubmit || loading" @click="submitTask">
        {{ loading ? '生成中...' : '🎬 生成视频' }}
      </button>
    </div>

    <div v-if="taskId || loading" class="status-section">
      <div class="status-card" :class="statusClass">
        <div class="status-header">
          <span class="status-icon">{{ statusIcon }}</span>
          <span class="status-text">{{ statusText }}</span>
          <span v-if="loading" class="spinner"></span>
        </div>
        <div class="task-id" v-if="taskId">
          Task ID: <code>{{ taskId }}</code>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      </div>
    </div>

    <VideoResult v-if="videoUrl" :video-url="videoUrl" />
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { createTextToVideoTask, pollTaskUntilDone } from '../api/happyhorse.js'
import { addHistory } from '../api/history.js'
import VideoResult from './VideoResult.vue'

const props = defineProps({
  apiKey: { type: String, default: '' }
})

const form = reactive({
  prompt: '',
  resolution: '',
  size: '',
  duration: ''
})

const loading = ref(false)
const taskId = ref('')
const taskStatus = ref('')
const videoUrl = ref('')
const errorMsg = ref('')

const canSubmit = computed(() => props.apiKey && form.prompt.trim())

const statusClass = computed(() => {
  const s = taskStatus.value
  if (s === 'SUCCEEDED') return 'status-success'
  if (s === 'FAILED') return 'status-error'
  if (s === 'RUNNING') return 'status-running'
  return 'status-pending'
})

const statusIcon = computed(() => {
  const s = taskStatus.value
  if (s === 'SUCCEEDED') return '✅'
  if (s === 'FAILED') return '❌'
  if (s === 'RUNNING') return '🔄'
  return '⏳'
})

const statusText = computed(() => {
  const s = taskStatus.value
  if (s === 'SUCCEEDED') return '生成成功！'
  if (s === 'FAILED') return '生成失败'
  if (s === 'RUNNING') return '正在生成中...'
  if (s === 'PENDING') return '排队中...'
  return '提交任务中...'
})

async function submitTask() {
  if (!canSubmit.value) return

  loading.value = true
  taskId.value = ''
  taskStatus.value = ''
  videoUrl.value = ''
  errorMsg.value = ''

  try {
    const params = { prompt: form.prompt.trim() }
    if (form.resolution) params.resolution = form.resolution
    if (form.size) params.size = form.size
    if (form.duration) params.duration = Number(form.duration)

    const output = await createTextToVideoTask(props.apiKey, params)
    taskId.value = output.task_id
    taskStatus.value = output.task_status || 'PENDING'

    const result = await pollTaskUntilDone(
      props.apiKey,
      output.task_id,
      (o) => { taskStatus.value = o.task_status },
      5000
    )

    if (result.task_status === 'SUCCEEDED') {
      const url = result.video_url ||
        (result.results && result.results[0] && result.results[0].url) || ''
      videoUrl.value = url

      // 保存历史记录
      if (url) {
        addHistory({
          category: 'video',
          type: 'text-to-video',
          prompt: form.prompt.trim(),
          videoUrl: url,
          taskId: output.task_id,
          params: { ...params }
        })
      }
    } else {
      errorMsg.value = result.message || '视频生成失败，请重试'
    }
  } catch (err) {
    console.error(err)
    errorMsg.value = err.response?.data?.message || err.message || '请求失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.panel { animation: fadeIn 0.3s ease; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-section {
  background: #222222;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
  margin-bottom: 16px;
}

.form-group { margin-bottom: 14px; }

.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 6px;
}

.form-group textarea,
.form-group select {
  width: 100%;
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #f0f0f0;
  font-size: 0.95rem;
  outline: none;
  resize: vertical;
  font-family: inherit;
}

.form-group textarea:focus,
.form-group select:focus {
  border-color: #999;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #444, #555);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-primary:not(:disabled):hover { opacity: 0.85; }

.status-section { margin-bottom: 16px; }

.status-card {
  padding: 16px;
  border-radius: 10px;
  border: 1px solid #3a3a3a;
  background: #222222;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 500;
}

.task-id { margin-top: 8px; font-size: 0.8rem; color: #bbb; }
.task-id code { color: #999; word-break: break-all; }

.error-msg { margin-top: 8px; color: #cc4444; font-size: 0.9rem; }

.spinner {
  width: 16px; height: 16px;
  border: 2px solid #444;
  border-top-color: #999;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-left: auto;
}

@keyframes spin { to { transform: rotate(360deg); } }

.status-pending { border-color: #555; }
.status-running { border-color: #999; }
.status-success { border-color: #999; }
.status-error { border-color: #cc4444; }
</style>
