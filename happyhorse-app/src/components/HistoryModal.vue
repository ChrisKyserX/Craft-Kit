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

              <!-- 上传中 loading -->
              <div v-if="item._uploading" class="card-uploading">
                <div class="upload-spinner"></div>
                <span>上传中...</span>
              </div>

              <!-- 已上传标识 -->
              <div v-if="item.cosUploaded" class="card-uploaded-badge">
                ✅ 已上传
              </div>

              <!-- 上传按钮（hover 时显示，仅未上传的文件） -->
              <button
                v-if="cosAvailable && !item.cosUploaded && !item._uploading"
                class="card-upload-btn"
                @click.stop="openUploadDialog(item)"
                title="上传到 COS"
              >
                ⬆️
              </button>
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

    <!-- 上传文件名输入弹窗 -->
    <div v-if="showNameDialog" class="name-dialog-overlay" @click.self="showNameDialog = false">
      <div class="name-dialog">
        <div class="name-dialog-header">
          <h3>⬆️ 上传到 COS</h3>
          <button class="btn-close" @click="showNameDialog = false">✕</button>
        </div>
        <div class="name-dialog-body">
          <p class="dialog-desc">
            文件将上传到：<code>{{ uploadingItem?.category === 'image' ? 'image_create_record' : 'video_create_record' }}/{{ todayFolder }}/</code>
          </p>
          <div class="form-group">
            <label>文件名称</label>
            <input
              v-model="uploadFileName"
              type="text"
              placeholder="输入文件名（含扩展名）"
              @keyup.enter="confirmUpload"
            />
          </div>
          <div v-if="uploadError" class="error-inline">❌ {{ uploadError }}</div>
        </div>
        <div class="name-dialog-footer">
          <button class="btn-cancel" @click="showNameDialog = false">取消</button>
          <button
            class="btn-confirm"
            :disabled="!uploadFileName.trim() || isUploading"
            @click="confirmUpload"
          >
            {{ isUploading ? '上传中...' : '确定上传' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getHistory, removeHistory, clearHistory, markUploaded } from '../api/history.js'
import { getCosConfig, listObjects, createFolder, uploadFileFromUrl } from '../api/cos.js'

defineEmits(['close', 'view'])

const activeTab = ref('video')
const historyList = ref(getHistory())

// COS 相关
const cosAvailable = ref(false)

// 上传弹窗
const showNameDialog = ref(false)
const uploadFileName = ref('')
const uploadError = ref('')
const isUploading = ref(false)
const uploadingItem = ref(null)
const todayFolder = ref('')

// 生成今天日期文件夹名 YYYY-MM-DD
function getTodayFolder() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

onMounted(() => {
  todayFolder.value = getTodayFolder()
  checkCosAvailable()
})

async function checkCosAvailable() {
  const config = getCosConfig()
  if (!config.bucket || !config.secretId || !config.secretKey) {
    cosAvailable.value = false
    return
  }

  // 尝试列出根目录，判断是否可用
  try {
    await listObjects('')
    cosAvailable.value = true
    // 标记成功访问过
    localStorage.setItem('cos_last_success', Date.now().toString())
  } catch {
    cosAvailable.value = false
  }
}

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

// === 上传功能 ===

function openUploadDialog(item) {
  uploadingItem.value = item
  const isImage = item.category === 'image'
  // 默认文件名：用 task_id 或 id
  const ext = isImage ? '.png' : '.mp4'
  uploadFileName.value = `${item.taskId || item.id}${ext}`
  uploadError.value = ''
  showNameDialog.value = true
}

async function confirmUpload() {
  const fileName = uploadFileName.value.trim()
  if (!fileName) {
    uploadError.value = '请输入文件名称'
    return
  }

  const item = uploadingItem.value
  if (!item) {
    uploadError.value = '无有效记录'
    return
  }

  const isImage = item.category === 'image'
  const fileUrl = isImage ? (item.imageUrl || item.imageUrls?.[0]) : item.videoUrl

  if (!fileUrl) {
    uploadError.value = isImage ? '无有效图片链接' : '无有效视频链接'
    return
  }

  isUploading.value = true
  uploadError.value = ''
  item._uploading = true

  try {
    const basePath = isImage
      ? `image_create_record/${todayFolder.value}/`
      : `video_create_record/${todayFolder.value}/`

    // 1. 检查父文件夹是否存在
    const parentPrefix = isImage ? 'image_create_record/' : 'video_create_record/'
    let folderExists = false
    try {
      const result = await listObjects(parentPrefix)
      folderExists = result.folders.includes(todayFolder.value)
    } catch {
      folderExists = false
    }

    // 2. 不存在则创建
    if (!folderExists) {
      try {
        await createFolder(parentPrefix)
      } catch {
        // 可能已存在，忽略
      }
      try {
        await createFolder(basePath)
      } catch (err) {
        throw new Error(`创建文件夹失败：${err.message || '未知错误'}`)
      }
    }

    // 3. 上传文件
    const fullKey = basePath + fileName
    await uploadFileFromUrl(fullKey, fileUrl)

    // 4. 标记为已上传
    markUploaded(item.id)
    item.cosUploaded = true

    showNameDialog.value = false
  } catch (err) {
    uploadError.value = err.message || '上传失败'
  } finally {
    isUploading.value = false
    item._uploading = false
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
  background: #222222;
  border: 1px solid #3a3a3a;
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
  border-bottom: 1px solid #3a3a3a;
}

.modal-header h2 { font-size: 1.2rem; color: #f0f0f0; }

.header-actions { display: flex; gap: 8px; }

.btn-clear {
  background: transparent;
  border: 1px solid #cc444444;
  color: #cc4444;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-clear:hover { background: #cc444422; }

.btn-close {
  background: #3a3a3a;
  border: none;
  color: #ddd;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-close:hover { background: #555555; }

.modal-tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px;
  background: #1a1a1a;
}

.modal-tabs button {
  flex: 1;
  padding: 8px;
  background: transparent;
  border: none;
  color: #999;
  font-size: 0.9rem;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.modal-tabs button.active { background: #3a3a3a; color: #fff; }

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #bbb;
}

.empty-icon { font-size: 3rem; display: block; margin-bottom: 12px; }

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.history-card {
  background: #111111;
  border: 1px solid #3a3a3a;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
  position: relative;
}

.history-card:hover {
  border-color: #999;
  transform: translateY(-2px);
}

.card-thumb {
  width: 100%;
  height: 130px;
  background: #1a1a1a;
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

.thumb-placeholder { font-size: 2.5rem; opacity: 0.5; }

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

.card-info { padding: 10px; }

.card-prompt {
  font-size: 0.85rem;
  color: #f0f0f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.card-time { font-size: 0.75rem; color: #bbb; }

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

.history-card:hover .card-delete { opacity: 1; }
.card-delete:hover { background: rgba(255, 107, 107, 0.8); }

/* 上传按钮 */
.card-upload-btn {
  position: absolute;
  top: 6px;
  right: 40px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-card:hover .card-upload-btn { opacity: 1; }
.card-upload-btn:hover { background: rgba(78, 205, 196, 0.8); }

/* 上传中 loading */
.card-uploading {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #999;
  font-size: 0.8rem;
}

.upload-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #444;
  border-top-color: #999;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* 已上传标识 */
.card-uploaded-badge {
  position: absolute;
  bottom: 6px;
  left: 6px;
  background: rgba(107, 203, 119, 0.9);
  color: #fff;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

/* 文件名输入弹窗 */
.name-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: fadeIn 0.2s ease;
}

.name-dialog {
  background: #222222;
  border: 1px solid #3a3a3a;
  border-radius: 12px;
  width: 90%;
  max-width: 440px;
  animation: slideUp 0.3s ease;
}

.name-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #3a3a3a;
}

.name-dialog-header h3 { font-size: 1.1rem; color: #f0f0f0; }

.name-dialog-body { padding: 20px; }

.dialog-desc {
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 16px;
}

.dialog-desc code {
  background: #111111;
  color: #bbb;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.form-group { margin-bottom: 12px; }

.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #f0f0f0;
  font-size: 0.95rem;
  outline: none;
}

.form-group input:focus { border-color: #bbb; }

.error-inline {
  color: #cc4444;
  font-size: 0.85rem;
  margin-top: 8px;
}

.name-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #3a3a3a;
}

.btn-cancel {
  background: #3a3a3a;
  border: none;
  color: #ddd;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-cancel:hover { background: #555555; }

.btn-confirm {
  background: linear-gradient(135deg, #444, #333);
  border: none;
  color: #fff;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-confirm:not(:disabled):hover { opacity: 0.85; }
</style>
