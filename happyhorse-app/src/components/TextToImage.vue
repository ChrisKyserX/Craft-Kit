<template>
  <div class="panel">
    <div class="form-section">
      <div class="form-group">
        <label>提示词 (Prompt)</label>
        <textarea
          v-model="form.prompt"
          rows="3"
          placeholder="描述你想要生成的图片内容，例如：一只机械马在未来的城市街道上奔跑，赛博朋克风格，电影感镜头，4K高清"
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
        <div class="form-group" v-if="!model.sync">
          <label>生成数量</label>
          <select v-model="form.n">
            <option :value="1">1 张</option>
            <option :value="2">2 张</option>
            <option :value="3">3 张</option>
            <option :value="4">4 张</option>
          </select>
        </div>
      </div>

      <div class="form-row" v-if="model.sync">
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.promptExtend" />
            <span>智能提示词扩展 (prompt_extend)</span>
          </label>
          <p class="hint">自动优化和扩展简短提示词，默认开启</p>
        </div>
      </div>

      <div class="form-row" v-if="!model.sync">
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.thinkingMode" />
            <span>思考模式 (thinking_mode)</span>
          </label>
          <p class="hint">增强推理，提高生成质量</p>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.watermark" />
            <span>添加水印 (watermark)</span>
          </label>
        </div>
      </div>

      <div class="form-group" v-if="!model.sync">
        <label>负向提示词 (Negative Prompt) — 可选</label>
        <textarea
          v-model="form.negativePrompt"
          rows="2"
          placeholder="描述不想要的内容，例如：模糊，低质量，变形"
        ></textarea>
        <p class="hint">wan2.7 系列不支持负向提示词</p>
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
  prompt: '',
  size: '',
  n: 1,
  promptExtend: true,
  thinkingMode: true,
  watermark: false,
  negativePrompt: ''
})

const loading = ref(false)
const taskId = ref('')
const taskStatus = ref('')
const imageUrls = ref([])
const errorMsg = ref('')

const canSubmit = computed(() => props.apiKey && form.prompt.trim())

const sizeOptions = computed(() => {
  // 根据模型提供不同的尺寸选项
  if (!props.model.sync) {
    // Wan 异步模型
    return [
      { value: '1K', label: '1K (1024×1024)' },
      { value: '2K', label: '2K (2048×2048)' },
      { value: '4K', label: '4K (4096×4096)' },
      { value: '1024*1024', label: '1024×1024 (1:1)' },
      { value: '1024*768', label: '1024×768 (4:3)' },
      { value: '768*1024', label: '768×1024 (3:4)' },
      { value: '1280*720', label: '1280×720 (16:9)' },
      { value: '720*1280', label: '720×1280 (9:16)' },
    ]
  }
  // Qwen / Z-Image 同步模型
  return [
    { value: '1024*1024', label: '1024×1024 (1:1)' },
    { value: '1024*768', label: '1024×768 (4:3)' },
    { value: '768*1024', label: '768×1024 (3:4)' },
    { value: '1280*720', label: '1280×720 (16:9)' },
    { value: '720*1280', label: '720×1280 (9:16)' },
    { value: '1664*928', label: '1664×928 (16:9 高清)' },
    { value: '928*1664', label: '928×1664 (9:16 高清)' },
    { value: '2048*2048', label: '2048×2048 (1:1 高清)' },
  ]
})

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
      prompt: form.prompt.trim(),
      size: form.size || undefined,
      prompt_extend: form.promptExtend,
      n: form.n
    }

    if (!props.model.sync) {
      params.thinking_mode = form.thinkingMode
      params.watermark = form.watermark
      if (form.negativePrompt.trim()) {
        params.negative_prompt = form.negativePrompt.trim()
      }
    }

    const result = await createImageTask(props.apiKey, props.model, params)

    if (result.sync) {
      // 同步模型：直接得到结果
      imageUrls.value = result.images || []
      taskStatus.value = 'SUCCEEDED'
    } else {
      // 异步模型：需要轮询
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
        type: 'text-to-image',
        prompt: form.prompt.trim(),
        imageUrl: imageUrls.value[0],
        imageUrls: imageUrls.value,
        taskId: taskId.value || 'sync',
        modelId: props.model.id,
        modelName: props.model.name,
        params: {
          size: params.size || '默认',
          n: params.n,
          promptExtend: props.model.sync ? form.promptExtend : undefined,
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