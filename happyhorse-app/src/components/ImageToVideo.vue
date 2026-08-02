<template>
  <div class="panel">
    <div class="form-section">
      <div class="form-group">
        <label>首帧图片</label>
        <div class="image-input-row">
          <input
            v-model="form.imageUrl"
            type="text"
            placeholder="输入图片 URL、拖拽图片到下方区域、或点击选择"
            class="url-input"
          />
          <label class="upload-btn">
            📁 选择图片
            <input
              type="file"
              accept="image/*"
              @change="handleFileUpload"
              style="display: none"
            />
          </label>
        </div>

        <!-- 拖拽上传区域 -->
        <div
          class="drop-zone"
          :class="{ 'drag-over': dragging }"
          @dragenter.prevent="dragging = true"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="handleDrop"
        >
          <div v-if="previewUrl" class="preview-area">
            <img :src="previewUrl" alt="预览" />
            <button class="remove-btn" @click="removeImage">✕</button>
          </div>
          <div v-else class="drop-hint">
            <span class="drop-icon">🖼️</span>
            <p>{{ dragging ? '松开鼠标即可上传' : '拖拽图片到此处上传' }}</p>
            <p class="drop-sub">支持 JPG / PNG / WebP</p>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label>提示词 (Prompt) — 可选</label>
        <textarea
          v-model="form.prompt"
          rows="2"
          placeholder="描述期望的视频运动效果，例如：镜头缓慢推进，画面中的数据流缓慢移动"
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>尺寸</label>
          <select v-model="form.size">
            <option value="">跟随首帧</option>
            <option value="1280*720">1280×720 (16:9)</option>
            <option value="720*1280">720×1280 (9:16)</option>
            <option value="960*960">960×960 (1:1)</option>
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
import { createImageToVideoTask, pollTaskUntilDone } from '../api/happyhorse.js'
import { addHistory } from '../api/history.js'
import VideoResult from './VideoResult.vue'

const props = defineProps({
  apiKey: { type: String, default: '' }
})

const form = reactive({
  imageUrl: '',
  prompt: '',
  size: '',
  duration: ''
})

const loading = ref(false)
const taskId = ref('')
const taskStatus = ref('')
const videoUrl = ref('')
const errorMsg = ref('')
const previewUrl = ref('')
const dragging = ref(false)

const canSubmit = computed(() => props.apiKey && form.imageUrl.trim())

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) return
  const dataUrl = await readFileAsDataUrl(file)
  form.imageUrl = dataUrl
  previewUrl.value = dataUrl
  dragging.value = false
}

function handleFileUpload(event) {
  loadImage(event.target.files[0])
}

async function handleDrop(event) {
  dragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) await loadImage(file)
}

function removeImage() {
  form.imageUrl = ''
  previewUrl.value = ''
}

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
    const params = { imageUrl: form.imageUrl.trim(), prompt: form.prompt.trim() }
    if (form.size) params.size = form.size
    if (form.duration) params.duration = Number(form.duration)

    const output = await createImageToVideoTask(props.apiKey, params)
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
          type: 'image-to-video',
          prompt: form.prompt.trim(),
          imageUrl: form.imageUrl.startsWith('data:') ? '' : form.imageUrl.trim(),
          videoUrl: url,
          taskId: output.task_id,
          params: { size: params.size, duration: params.duration }
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
  background: #1a1a2e;
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #2a2a4a;
  margin-bottom: 16px;
}

.form-group { margin-bottom: 14px; }

.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
  resize: vertical;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: #ffd93d;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #ff6b6b, #ffd93d);
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
  border: 1px solid #2a2a4a;
  background: #1a1a2e;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1rem;
  font-weight: 500;
}

.task-id { margin-top: 8px; font-size: 0.8rem; color: #666; }
.task-id code { color: #888; word-break: break-all; }

.error-msg { margin-top: 8px; color: #ff6b6b; font-size: 0.9rem; }

.spinner {
  width: 16px; height: 16px;
  border: 2px solid #444;
  border-top-color: #ffd93d;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-left: auto;
}

@keyframes spin { to { transform: rotate(360deg); } }

.status-pending { border-color: #555; }
.status-running { border-color: #ffd93d; }
.status-success { border-color: #6bcb77; }
.status-error { border-color: #ff6b6b; }

.image-input-row {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
}

.url-input:focus {
  border-color: #ffd93d;
}

.upload-btn {
  background: #2a2a4a;
  border: 1px solid #444;
  color: #ccc;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
  transition: background 0.2s;
}

.upload-btn:hover {
  background: #3a3a5a;
}

.drop-zone {
  margin-top: 12px;
  border: 2px dashed #333;
  border-radius: 10px;
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, background 0.2s;
  cursor: pointer;
  position: relative;
}

.drop-zone:hover {
  border-color: #555;
}

.drop-zone.drag-over {
  border-color: #ffd93d;
  background: rgba(255, 217, 61, 0.05);
}

.drop-hint {
  text-align: center;
  color: #666;
  pointer-events: none;
}

.drop-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 8px;
}

.drop-hint p {
  font-size: 0.9rem;
  margin: 2px 0;
}

.drop-sub {
  font-size: 0.75rem !important;
  color: #555 !important;
}

.preview-area {
  position: relative;
  display: inline-block;
  padding: 10px;
}

.preview-area img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  background: #ff6b6b;
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #ff5252;
}
</style>
