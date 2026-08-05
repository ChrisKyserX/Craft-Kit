<template>
  <div class="panel">
    <div class="form-section">
      <div class="form-group">
        <label>参考图片</label>
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
          placeholder="描述期望的图片变换效果，例如：将这张照片变成水彩画风格"
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>尺寸</label>
          <select v-model="form.size">
            <option value="">默认</option>
            <option v-for="s in sizeOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
      </div>

      <div class="form-row" v-if="!model.sync">
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.thinkingMode" />
            <span>思考模式 (thinking_mode)</span>
          </label>
          <p class="hint">增强推理，提高变换质量</p>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.watermark" />
            <span>添加水印</span>
          </label>
        </div>
      </div>

      <button class="btn-primary" :disabled="!canSubmit || loading" @click="submitTask">
        {{ loading ? '生成中...' : '🎨 生成图片' }}
      </button>
    </div>

    <div v-if="taskId || loading" class="status-section">
      <div class="status-card" :class="statusClass">
        <div class="status-header">
          <span class="status-icon">{{ statusIcon }}</span>
          <span class="status-text">{{ statusText }}</span>
          <span v-if="loading && !model.sync" class="spinner"></span>
        </div>
        <div class="task-id" v-if="taskId">
          Task ID: <code>{{ taskId }}</code>
        </div>
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
      </div>
    </div>

    <ImageResult v-if="imageUrls.length > 0" :image-urls="imageUrls" />
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { createImageTask, pollTaskUntilDone, extractImageUrls } from '../api/imageGen.js'
import { addHistory } from '../api/history.js'
import ImageResult from './ImageResult.vue'

const props = defineProps({
  apiKey: { type: String, default: '' },
  model: { type: Object, required: true }
})

const form = reactive({
  imageUrl: '',
  prompt: '',
  size: '',
  thinkingMode: true,
  watermark: false
})

const loading = ref(false)
const taskId = ref('')
const taskStatus = ref('')
const imageUrls = ref([])
const errorMsg = ref('')
const previewUrl = ref('')
const dragging = ref(false)

const canSubmit = computed(() => props.apiKey && form.imageUrl.trim())

const sizeOptions = computed(() => {
  if (!props.model.sync) {
    return [
      { value: '2K', label: '2K (2048×2048)' },
      { value: '1024*1024', label: '1024×1024 (1:1)' },
      { value: '1024*768', label: '1024×768 (4:3)' },
      { value: '768*1024', label: '768×1024 (3:4)' },
    ]
  }
  return [
    { value: '1024*1024', label: '1024×1024 (1:1)' },
    { value: '1024*768', label: '1024×768 (4:3)' },
    { value: '768*1024', label: '768×1024 (3:4)' },
    { value: '2048*2048', label: '2048×2048 (1:1 高清)' },
  ]
})

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
  imageUrls.value = []
  errorMsg.value = ''

  try {
    const params = {
      imageUrl: form.imageUrl.trim(),
      prompt: form.prompt.trim(),
      size: form.size || undefined
    }

    if (!props.model.sync) {
      params.thinking_mode = form.thinkingMode
      params.watermark = form.watermark
    }

    const result = await createImageTask(props.apiKey, props.model, params)

    if (result.sync) {
      imageUrls.value = result.images || []
      taskStatus.value = 'SUCCEEDED'
    } else {
      taskId.value = result.taskId
      taskStatus.value = result.taskStatus || 'PENDING'

      const finalResult = await pollTaskUntilDone(
        props.apiKey,
        result.taskId,
        (o) => { taskStatus.value = o.task_status },
        5000
      )

      if (finalResult.task_status === 'SUCCEEDED') {
        imageUrls.value = extractImageUrls(finalResult)
      } else {
        errorMsg.value = finalResult.message || '图片生成失败，请重试'
      }
    }

    // 保存历史记录
    if (imageUrls.value.length > 0) {
      addHistory({
        category: 'image',
        type: 'image-to-image',
        prompt: form.prompt.trim(),
        imageUrl: imageUrls.value[0],
        imageUrls: imageUrls.value,
        inputImageUrl: form.imageUrl.startsWith('data:') ? '' : form.imageUrl.trim(),
        taskId: taskId.value || 'sync',
        modelId: props.model.id,
        modelName: props.model.name,
        params: {
          size: params.size || '默认',
          thinkingMode: !props.model.sync ? form.thinkingMode : undefined,
          watermark: !props.model.sync ? form.watermark : undefined
        }
      })
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

.form-group input,
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

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  border-color: #999;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: #999;
  cursor: pointer;
}

.checkbox-label span {
  color: #ddd;
  font-size: 0.9rem;
}

.hint {
  font-size: 0.75rem;
  color: #bbb;
  margin-top: 4px;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #555, #333);
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

.image-input-row {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #f0f0f0;
  font-size: 0.95rem;
  outline: none;
}

.url-input:focus {
  border-color: #999;
}

.upload-btn {
  background: #3a3a3a;
  border: 1px solid #444;
  color: #ddd;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  white-space: nowrap;
  transition: background 0.2s;
}

.upload-btn:hover {
  background: #555555;
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
  border-color: #999;
  background: rgba(255, 180, 100, 0.05);
}

.drop-hint {
  text-align: center;
  color: #bbb;
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
  background: #cc4444;
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
  background: #cc4444;
}
</style>