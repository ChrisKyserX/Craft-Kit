<template>
  <div>
    <header class="page-header">
      <h1>🐴 HappyHorse 视频生成</h1>
      <div class="api-key-bar">
        <label>API Key：</label>
        <input
          v-model="apiKey"
          type="password"
          placeholder="sk-xxxxxxxxxxxxxxxx"
          @change="saveApiKey"
        />
        <button class="btn-small" @click="toggleKeyVisibility">
          {{ showKey ? '隐藏' : '显示' }}
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
  const input = document.querySelector('.api-key-bar input')
  input.type = showKey.value ? 'text' : 'password'
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
  background: linear-gradient(135deg, #ff6b6b, #ffd93d, #6bcb77);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
}

.api-key-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1a1a2e;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #2a2a4a;
}

.api-key-bar label {
  font-size: 0.9rem;
  white-space: nowrap;
  color: #888;
}

.api-key-bar input {
  flex: 1;
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 0.9rem;
  outline: none;
}

.api-key-bar input:focus {
  border-color: #6bcb77;
}

.btn-small {
  background: #2a2a4a;
  border: 1px solid #444;
  color: #ccc;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
}

.btn-small:hover {
  background: #3a3a5a;
}

.btn-history {
  border-color: #ffd93d44;
  color: #ffd93d;
}

.btn-history:hover {
  background: #ffd93d22;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  background: #1a1a2e;
  padding: 4px;
  border-radius: 10px;
}

.tabs button {
  flex: 1;
  padding: 10px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 1rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.tabs button.active {
  background: #2a2a4a;
  color: #fff;
}

.tabs button:hover:not(.active) {
  color: #ccc;
}

.content {
  min-height: 400px;
}
</style>
