<template>
  <div>
    <header class="page-header">
      <h1>🖼️ HappyHorse 图片生成</h1>
      <div class="api-key-bar">
        <label>API Key：</label>
        <input
          v-model="apiKey"
          type="text"
          :class="['input-secret', { 'input-secret--visible': showKey }]"
          placeholder="sk-xxxxxxxxxxxxxxxx"
          @change="saveApiKey"
        />
        <button class="btn-small" @click="toggleKeyVisibility" :title="showKey ? '隐藏' : '显示'">
          {{ showKey ? '👁️' : '👁️‍🗨️' }}
        </button>
        <button class="btn-small btn-history" @click="showHistory = true">
          📜 历史
        </button>
      </div>
    </header>

    <!-- 模型选择器 -->
    <div class="model-selector">
      <div class="model-selector-header">
        <span>🤖 选择模型</span>
        <span class="selected-model-info" v-if="selectedModel">
          {{ selectedModel.name }} —
          <span :class="selectedModel.sync ? 'tag-sync' : 'tag-async'">
            {{ selectedModel.sync ? '同步' : '异步' }}
          </span>
        </span>
      </div>
      <div v-for="group in modelGroups" :key="group.key" class="model-group">
        <span class="model-group-label">{{ group.label }}</span>
        <div class="model-options">
          <button
            v-for="m in group.models"
            :key="m.id"
            :class="['model-btn', { active: selectedModelId === m.id }]"
            @click="selectModel(m)"
            :title="m.desc"
          >
            <span class="model-btn-name">{{ m.name }}</span>
            <span class="model-btn-desc">{{ m.desc }}</span>
          </button>
        </div>
      </div>
    </div>

    <nav class="tabs">
      <button :class="{ active: activeTab === 't2i' }" @click="activeTab = 't2i'">
        ✍️ 文生图
      </button>
      <button :class="{ active: activeTab === 'i2i' }" @click="activeTab = 'i2i'">
        🖼️ 图生图
      </button>
    </nav>

    <main class="content">
      <TextToImage v-if="activeTab === 't2i'" :api-key="apiKey" :model="selectedModel" />
      <ImageToImage v-if="activeTab === 'i2i'" :api-key="apiKey" :model="selectedModel" />
    </main>

    <!-- 历史记录弹窗 -->
    <HistoryModal
      v-if="showHistory"
      @close="showHistory = false"
      @view="viewDetail"
    />

    <!-- 详情弹窗 -->
    <HistoryDetailModal
      v-if="detailItem"
      :item="detailItem"
      @close="detailItem = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { IMAGE_MODELS, getAllModels, findModel } from '../api/imageGen.js'
import TextToImage from '../components/TextToImage.vue'
import ImageToImage from '../components/ImageToImage.vue'
import HistoryModal from '../components/HistoryModal.vue'
import HistoryDetailModal from '../components/HistoryDetailModal.vue'

const MODEL_STORAGE_KEY = 'happyhorse_image_model'

const apiKey = ref('')
const showKey = ref(false)
const activeTab = ref('t2i')
const showHistory = ref(false)
const detailItem = ref(null)

// 初始化：优先从缓存读取，否则用默认模型
const cachedModel = localStorage.getItem(MODEL_STORAGE_KEY)
const selectedModelId = ref(cachedModel && findModel(cachedModel) ? cachedModel : IMAGE_MODELS.qwen[0].id)

// 模型分组
const modelGroups = computed(() => {
  return [
    { key: 'qwen', label: '🏷️ Qwen Image 系列', models: IMAGE_MODELS.qwen },
    { key: 'wan', label: '🌊 Wan 万象系列', models: IMAGE_MODELS.wan },
    { key: 'zimage', label: '⚡ Z-Image 系列', models: IMAGE_MODELS.zimage },
  ]
})

const selectedModel = computed(() => findModel(selectedModelId.value))

onMounted(() => {
  apiKey.value = localStorage.getItem('happyhorse_api_key') || ''
})

function saveApiKey() {
  localStorage.setItem('happyhorse_api_key', apiKey.value)
}

function toggleKeyVisibility() {
  showKey.value = !showKey.value
}

function selectModel(model) {
  selectedModelId.value = model.id
  localStorage.setItem(MODEL_STORAGE_KEY, model.id)
}

function viewDetail(item) {
  detailItem.value = item
}
</script>

<style scoped>
.page-header {
  text-align: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 1.8rem;
  color: #f0f0f0;
  margin-bottom: 16px;
}

.api-key-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #222222;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #3a3a3a;
}

.api-key-bar label {
  font-size: 0.9rem;
  white-space: nowrap;
  color: #999;
}

.api-key-bar input {
  flex: 1;
  background: #111111;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px 12px;
  color: #f0f0f0;
  font-size: 0.9rem;
  outline: none;
}

.api-key-bar input:focus {
  border-color: #999;
}

.input-secret {
  -webkit-text-security: disc;
}

.input-secret.input-secret--visible {
  -webkit-text-security: none;
}

.btn-small {
  background: #3a3a3a;
  border: 1px solid #444;
  color: #ddd;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-small:hover {
  background: #555555;
}

.btn-history {
  border-color: #99944;
  color: #999;
}

.btn-history:hover {
  background: #88888822;
}

/* 模型选择器 */
.model-selector {
  background: #222222;
  border: 1px solid #3a3a3a;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}

.model-selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 0.9rem;
  color: #999;
}

.selected-model-info {
  font-size: 0.8rem;
  color: #bbb;
}

.tag-sync {
  background: #2a6b2a;
  color: #7ec87e;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.tag-async {
  background: #6b5a2a;
  color: #c8b87e;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.model-group {
  margin-bottom: 10px;
}

.model-group:last-child {
  margin-bottom: 0;
}

.model-group-label {
  display: block;
  font-size: 0.75rem;
  color: #888;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.model-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.model-btn {
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 150px;
}

.model-btn:hover {
  border-color: #999;
}

.model-btn.active {
  border-color: #999;
  background: #2a2a2a;
  box-shadow: 0 0 0 1px #999;
}

.model-btn-name {
  font-size: 0.85rem;
  color: #f0f0f0;
  font-weight: 500;
}

.model-btn-desc {
  font-size: 0.7rem;
  color: #bbb;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: #222222;
  padding: 4px;
  border-radius: 10px;
}

.tabs button {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  color: #999;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.tabs button.active {
  background: #3a3a3a;
  color: #fff;
}

.tabs button:hover:not(.active) {
  color: #ddd;
}

.content {
  min-height: 400px;
}
</style>