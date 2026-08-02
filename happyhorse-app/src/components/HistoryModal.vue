<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h2>📜 历史记录</h2>
        <div class="header-actions">
          <button class="btn-clear" @click="confirmClear" v-if="historyList.length > 0">
            🗑️ 清空
          </button>
          <button class="btn-close" @click="$emit('close')">✕</button>
        </div>
      </div>

      <nav class="modal-tabs">
        <button :class="{ active: activeTab === 'video' }" @click="activeTab = 'video'">
          🎬 视频 ({{ videoList.length }})
        </button>
        <button :class="{ active: activeTab === 'image' }" @click="activeTab = 'image'">
          🖼️ 图片 ({{ imageList.length }})
        </button>
      </nav>

      <div class="modal-body">
        <div v-if="currentList.length === 0" class="empty-state">
          <span class="empty-icon">{{ activeTab === 'video' ? '🎬' : '🖼️' }}</span>
          <p>暂无{{ activeTab === 'video' ? '视频' : '图片' }}记录</p>
        </div>

        <div v-else class="history-grid">
          <div
            v-for="item in currentList"
            :key="item.id"
            class="history-card"
            @click="$emit('view', item)"
          >
            <div class="card-thumb">
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="首帧" />
              <div v-else class="thumb-placeholder">🎬</div>
              <div class="card-duration" v-if="item.params?.duration">
                {{ item.params.duration }}s
              </div>
            </div>
            <div class="card-info">
              <p class="card-prompt">{{ item.prompt || '无提示词' }}</p>
              <p class="card-time">{{ formatTime(item.createdAt) }}</p>
            </div>
            <button class="card-delete" @click.stop="deleteItem(item.id)" title="删除">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getHistory, removeHistory, clearHistory } from '../api/history.js'

defineEmits(['close', 'view'])

const activeTab = ref('video')
const historyList = ref(getHistory())

const videoList = computed(() =>
  historyList.value.filter(item => item.category === 'video')
)

const imageList = computed(() =>
  historyList.value.filter(item => item.category === 'image')
)

const currentList = computed(() =>
  activeTab.value === 'video' ? videoList.value : imageList.value
)

function formatTime(isoStr) {
  const d = new Date(isoStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function deleteItem(id) {
  removeHistory(id)
  historyList.value = getHistory()
}

function confirmClear() {
  if (confirm('确定清空所有历史记录？此操作不可恢复。')) {
    clearHistory()
    historyList.value = []
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-container {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 16px;
  width: 90%;
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #2a2a4a;
}

.modal-header h2 {
  font-size: 1.2rem;
  color: #e0e0e0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-clear {
  background: transparent;
  border: 1px solid #ff6b6b44;
  color: #ff6b6b;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-clear:hover {
  background: #ff6b6b22;
}

.btn-close {
  background: #2a2a4a;
  border: none;
  color: #ccc;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-close:hover {
  background: #3a3a5a;
}

.modal-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px;
  background: #151525;
}

.modal-tabs button {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: none;
  color: #888;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.modal-tabs button.active {
  background: #2a2a4a;
  color: #fff;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 12px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.history-card {
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
  position: relative;
}

.history-card:hover {
  border-color: #6bcb77;
  transform: translateY(-2px);
}

.card-thumb {
  width: 100%;
  height: 130px;
  background: #151525;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-placeholder {
  font-size: 2.5rem;
  opacity: 0.5;
}

.card-duration {
  position: absolute;
  bottom: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.card-info {
  padding: 10px;
}

.card-prompt {
  font-size: 0.85rem;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.card-time {
  font-size: 0.75rem;
  color: #666;
}

.card-delete {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.history-card:hover .card-delete {
  opacity: 1;
}

.card-delete:hover {
  background: rgba(255, 107, 107, 0.8);
}
</style>
