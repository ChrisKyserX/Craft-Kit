<template>
  <div>
    <header class="page-header">
      <h1>🐴 HappyHorse 视频生成</h1>
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

    <nav class="tabs">
      <button :class="{ active: activeTab === 't2v' }" @click="activeTab = 't2v'">
        ✍️ 文生视频
      </button>
      <button :class="{ active: activeTab === 'i2v' }" @click="activeTab = 'i2v'">
        🖼️ 图生视频
      </button>
    </nav>

    <main class="content">
      <TextToVideo v-if="activeTab === 't2v'" :api-key="apiKey" />
      <ImageToVideo v-if="activeTab === 'i2v'" :api-key="apiKey" />
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
import { ref, onMounted } from 'vue'
import TextToVideo from '../components/TextToVideo.vue'
import ImageToVideo from '../components/ImageToVideo.vue'
import HistoryModal from '../components/HistoryModal.vue'
import HistoryDetailModal from '../components/HistoryDetailModal.vue'

const apiKey = ref('')
const showKey = ref(false)
const activeTab = ref('t2v')
const showHistory = ref(false)
const detailItem = ref(null)

onMounted(() => {
  apiKey.value = localStorage.getItem('happyhorse_api_key') || ''
})

function saveApiKey() {
  localStorage.setItem('happyhorse_api_key', apiKey.value)
}

function toggleKeyVisibility() {
  showKey.value = !showKey.value
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
