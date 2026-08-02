<template>
  <div>
    <header class="page-header">
      <h1>📂 文件浏览</h1>
      <p class="subtitle">腾讯云 COS 对象存储</p>
      <div class="header-actions">
        <button class="btn-create-folder" @click="showCreateFolder = true">
          📁 新建文件夹
        </button>
        <button class="btn-upload" @click="showUpload = true">
          ⬆️ 上传文件
        </button>
        <button class="btn-settings" @click="showSettings = true">
          ⚙️ 存储配置
        </button>
      </div>
    </header>

    <!-- 路径导航 -->
    <div class="breadcrumb">
      <span class="crumb" @click="navigateTo('')">🏠 根目录</span>
      <template v-for="(crumb, i) in breadcrumbs" :key="i">
        <span class="separator">/</span>
        <span
          class="crumb"
          :class="{ current: i === breadcrumbs.length - 1 }"
          @click="navigateTo(crumb.path)"
        >
          {{ crumb.name }}
        </span>
      </template>
    </div>

    <!-- 文件列表 -->
    <div class="file-list" v-if="!loading">
      <!-- 文件夹 -->
      <div
        v-for="folder in folders"
        :key="folder"
        class="file-item folder"
        @click="enterFolder(folder)"
      >
        <span class="file-icon">📁</span>
        <span class="file-name">{{ folder }}</span>
      </div>

      <!-- 文件 -->
      <div
        v-for="file in files"
        :key="file.key"
        class="file-item"
        @click="selectFile(file)"
      >
        <span class="file-icon">{{ file.isImage ? '🖼️' : '📄' }}</span>
        <span class="file-name">{{ file.name }}</span>
        <span class="file-size">{{ formatSize(file.size) }}</span>
        <button class="btn-download" @click.stop="downloadFile(file)" title="下载">
          ⬇️
        </button>
      </div>

      <!-- 空状态 -->
      <div v-if="folders.length === 0 && files.length === 0" class="empty-state">
        <span class="empty-icon">📭</span>
        <p>此目录为空</p>
      </div>
    </div>

    <!-- 加载中 -->
    <div v-else class="loading-state">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="error-banner">
      <span>❌ {{ errorMsg }}</span>
      <button @click="loadFiles">重试</button>
    </div>

    <!-- 配置弹窗 -->
    <div v-if="showSettings" class="settings-overlay" @click.self="closeSettings">
      <div class="settings-container">
        <div class="settings-header">
          <h2>⚙️ 存储配置</h2>
          <button class="btn-close" @click="closeSettings">✕</button>
        </div>
        <div class="settings-body">
          <div class="form-group">
            <label>存储桶名称 (Bucket)</label>
            <input
              v-model="settingsForm.bucket"
              type="text"
              placeholder="例如：my-bucket-1250000000"
            />
          </div>
          <div class="form-group">
            <label>地域 (Region)</label>
            <select v-model="settingsForm.region">
              <option value="ap-beijing">北京 (ap-beijing)</option>
              <option value="ap-shanghai">上海 (ap-shanghai)</option>
              <option value="ap-guangzhou">广州 (ap-guangzhou)</option>
              <option value="ap-chengdu">成都 (ap-chengdu)</option>
              <option value="ap-chongqing">重庆 (ap-chongqing)</option>
              <option value="ap-nanjing">南京 (ap-nanjing)</option>
              <option value="ap-hongkong">香港 (ap-hongkong)</option>
              <option value="ap-singapore">新加坡 (ap-singapore)</option>
              <option value="ap-mumbai">孟买 (ap-mumbai)</option>
              <option value="ap-tokyo">东京 (ap-tokyo)</option>
              <option value="na-ashburn">弗吉尼亚 (na-ashburn)</option>
              <option value="eu-frankfurt">法兰克福 (eu-frankfurt)</option>
            </select>
          </div>
          <div class="form-group">
            <label>SecretId（可选，列出文件需要）</label>
            <input
              v-model="settingsForm.secretId"
              type="text"
              placeholder="AKIDxxxxxxxxxxxxxxxx"
            />
          </div>
          <div class="form-group">
            <label>SecretKey（可选，列出文件需要）</label>
            <input
              v-model="settingsForm.secretKey"
              type="password"
              placeholder="xxxxxxxxxxxxxxxx"
            />
          </div>
          <p class="settings-hint">
            💡 配置保存在浏览器本地。列出文件需要 SecretId/SecretKey，可在
            <a href="https://console.cloud.tencent.com/cam/capi" target="_blank">腾讯云控制台</a>
            获取。<strong>建议使用子账号密钥，仅授予 COS 只读权限。</strong>
          </p>
        </div>
        <div class="settings-footer">
          <button class="btn-cancel" @click="closeSettings">取消</button>
          <button class="btn-save" @click="saveSettings">保存配置</button>
        </div>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <div v-if="showUpload" class="upload-overlay" @click.self="closeUpload">
      <div class="upload-container">
        <div class="upload-header">
          <h2>⬆️ 上传文件</h2>
          <button class="btn-close" @click="closeUpload">✕</button>
        </div>
        <div class="upload-body">
          <div class="form-group">
            <label>目标路径</label>
            <div class="path-input-row">
              <input
                v-model="uploadPath"
                type="text"
                placeholder="例如：images/ 或 docs/2024/"
                class="path-input"
              />
              <button class="btn-use-current" @click="uploadPath = currentPath">
                📍 当前目录
              </button>
            </div>
            <p class="path-hint">以 / 结尾表示文件夹路径，留空则上传到根目录</p>
          </div>

          <div class="form-group">
            <label>选择文件</label>
            <div
              class="file-drop-zone"
              :class="{ 'drag-over': uploadDragOver }"
              @dragover.prevent="uploadDragOver = true"
              @dragleave.prevent="uploadDragOver = false"
              @drop.prevent="handleUploadDrop"
              @click="triggerFileSelect"
            >
              <input
                ref="fileInputRef"
                type="file"
                multiple
                style="display: none"
                @change="handleFileSelect"
              />
              <div v-if="uploadFiles.length === 0" class="drop-hint">
                <span class="drop-icon">📎</span>
                <p>点击选择文件或拖拽文件到此处</p>
                <p class="drop-sub">支持多文件同时上传</p>
              </div>
              <div v-else class="file-list-preview">
                <div v-for="(f, i) in uploadFiles" :key="i" class="upload-file-item">
                  <span class="file-icon">{{ getFileIcon(f.name) }}</span>
                  <span class="file-name">{{ f.name }}</span>
                  <span class="file-size">{{ formatSize(f.size) }}</span>
                  <button class="btn-remove-file" @click.stop="removeUploadFile(i)">✕</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 上传进度 -->
          <div v-if="uploading" class="upload-progress">
            <div class="progress-header">
              <span>正在上传 {{ currentUploadIndex + 1 }} / {{ uploadFiles.length }}</span>
              <span>{{ Math.round(uploadProgress * 100) }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: (uploadProgress * 100) + '%' }"></div>
            </div>
            <p class="progress-filename">{{ uploadFiles[currentUploadIndex]?.name }}</p>
          </div>
        </div>
        <div class="upload-footer">
          <button class="btn-cancel" @click="closeUpload" :disabled="uploading">取消</button>
          <button
            class="btn-upload-confirm"
            :disabled="uploadFiles.length === 0 || uploading"
            @click="startUpload"
          >
            {{ uploading ? '上传中...' : `上传 ${uploadFiles.length} 个文件` }}
          </button>
        </div>
      </div>
    </div>

    <!-- 创建文件夹弹窗 -->
    <div v-if="showCreateFolder" class="folder-overlay" @click.self="closeCreateFolder">
      <div class="folder-container">
        <div class="folder-header">
          <h2>📁 新建文件夹</h2>
          <button class="btn-close" @click="closeCreateFolder">✕</button>
        </div>
        <div class="folder-body">
          <div class="form-group">
            <label>父级路径</label>
            <div class="path-input-row">
              <input
                v-model="newFolderPath"
                type="text"
                placeholder="例如：images/ 或 docs/2024/"
                class="path-input"
              />
              <button class="btn-use-current" @click="newFolderPath = currentPath">
                📍 当前目录
              </button>
            </div>
            <p class="path-hint">将在该路径下创建新文件夹</p>
          </div>
          <div class="form-group">
            <label>文件夹名称</label>
            <input
              v-model="newFolderName"
              type="text"
              placeholder="例如：2024、photos、backup"
              @keyup.enter="confirmCreateFolder"
            />
            <p class="path-hint">不要包含 / 等特殊字符</p>
          </div>
          <div v-if="createFolderError" class="error-inline">❌ {{ createFolderError }}</div>
        </div>
        <div class="folder-footer">
          <button class="btn-cancel" @click="closeCreateFolder">取消</button>
          <button
            class="btn-create-confirm"
            :disabled="!newFolderName.trim() || creatingFolder"
            @click="confirmCreateFolder"
          >
            {{ creatingFolder ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <div v-if="previewFile" class="preview-overlay" @click.self="previewFile = null">
      <div class="preview-container">
        <div class="preview-header">
          <h3>{{ previewFile.name }}</h3>
          <div class="preview-actions">
            <button class="btn-action" @click="downloadFile(previewFile)">⬇️ 下载</button>
            <button class="btn-close" @click="previewFile = null">✕</button>
          </div>
        </div>
        <div class="preview-body">
          <img :src="previewFile.url" :alt="previewFile.name" />
        </div>
        <div class="preview-footer">
          <span>{{ formatSize(previewFile.size) }}</span>
          <span>{{ previewFile.lastModified }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { listObjects, getCosConfig, saveCosConfig, uploadFile, createFolder, formatSize } from '../api/cos.js'

const currentPath = ref('')
const folders = ref([])
const files = ref([])
const loading = ref(false)
const errorMsg = ref('')
const previewFile = ref(null)
const showSettings = ref(false)
const settingsForm = reactive({
  bucket: '',
  region: 'ap-beijing',
  secretId: '',
  secretKey: ''
})

// 上传相关
const showUpload = ref(false)
const uploadPath = ref('')
const uploadFiles = ref([])
const uploading = ref(false)
const uploadProgress = ref(0)
const currentUploadIndex = ref(0)
const uploadDragOver = ref(false)
const fileInputRef = ref(null)

// 创建文件夹相关
const showCreateFolder = ref(false)
const newFolderPath = ref('')
const newFolderName = ref('')
const creatingFolder = ref(false)
const createFolderError = ref('')

const breadcrumbs = computed(() => {
  if (!currentPath.value) return []
  const parts = currentPath.value.split('/').filter(Boolean)
  return parts.map((part, i) => ({
    name: part,
    path: parts.slice(0, i + 1).join('/') + '/'
  }))
})

onMounted(() => {
  // 加载缓存的配置
  const config = getCosConfig()
  settingsForm.bucket = config.bucket || ''
  settingsForm.region = config.region || 'ap-beijing'
  settingsForm.secretId = config.secretId || ''
  settingsForm.secretKey = config.secretKey || ''

  // 如果没有配置，自动弹出配置弹窗
  if (!config.bucket) {
    showSettings.value = true
  } else {
    loadFiles()
  }
})

function openSettings() {
  const config = getCosConfig()
  settingsForm.bucket = config.bucket || ''
  settingsForm.region = config.region || 'ap-beijing'
  settingsForm.secretId = config.secretId || ''
  settingsForm.secretKey = config.secretKey || ''
  showSettings.value = true
}

function closeSettings() {
  showSettings.value = false
}

function saveSettings() {
  if (!settingsForm.bucket.trim()) {
    alert('请输入存储桶名称')
    return
  }
  saveCosConfig({
    bucket: settingsForm.bucket.trim(),
    region: settingsForm.region,
    secretId: settingsForm.secretId.trim(),
    secretKey: settingsForm.secretKey.trim()
  })
  showSettings.value = false
  currentPath.value = ''
  loadFiles()
}

async function loadFiles() {
  loading.value = true
  errorMsg.value = ''
  try {
    const result = await listObjects(currentPath.value)
    folders.value = result.folders.sort()
    files.value = result.files.sort((a, b) => a.name.localeCompare(b.name))
  } catch (err) {
    console.error(err)
    errorMsg.value = err.response?.data?.message || err.message || '加载失败，请检查 COS 配置或存储桶权限'
  } finally {
    loading.value = false
  }
}

function navigateTo(path) {
  currentPath.value = path
  loadFiles()
}

function enterFolder(folderName) {
  currentPath.value = currentPath.value + folderName + '/'
  loadFiles()
}

function selectFile(file) {
  if (file.isImage) {
    previewFile.value = file
  } else {
    downloadFile(file)
  }
}

function downloadFile(file) {
  const link = document.createElement('a')
  link.href = file.url
  link.download = file.name
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// === 上传功能 ===

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase()
  const icons = {
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', bmp: '🖼️',
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵',
    pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗', ppt: '📙', pptx: '📙',
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
    js: '📜', ts: '📜', py: '📜', java: '📜', html: '📜', css: '📜', json: '📜',
    txt: '📝', md: '📝', log: '📝'
  }
  return icons[ext] || '📄'
}

function closeUpload() {
  if (uploading.value) return
  showUpload.value = false
  uploadPath.value = ''
  uploadFiles.value = []
  uploadProgress.value = 0
  currentUploadIndex.value = 0
  uploadDragOver.value = false
}

function triggerFileSelect() {
  fileInputRef.value?.click()
}

function handleFileSelect(event) {
  const selectedFiles = Array.from(event.target.files)
  uploadFiles.value.push(...selectedFiles)
  event.target.value = ''
}

function handleUploadDrop(event) {
  uploadDragOver.value = false
  const droppedFiles = Array.from(event.dataTransfer.files)
  uploadFiles.value.push(...droppedFiles)
}

function removeUploadFile(index) {
  uploadFiles.value.splice(index, 1)
}

async function startUpload() {
  if (uploadFiles.value.length === 0) return

  uploading.value = true
  uploadProgress.value = 0
  errorMsg.value = ''

  const basePath = uploadPath.value.startsWith('/')
    ? uploadPath.value.slice(1)
    : uploadPath.value

  for (let i = 0; i < uploadFiles.value.length; i++) {
    currentUploadIndex.value = i
    const file = uploadFiles.value[i]
    const key = basePath + file.name

    try {
      await uploadFile(key, file, (progress) => {
        uploadProgress.value = progress
      })
    } catch (err) {
      console.error(err)
      errorMsg.value = `上传 "${file.name}" 失败：${err.message || err}`
      uploading.value = false
      return
    }
  }

  uploading.value = false
  closeUpload()
  loadFiles()
}

// === 创建文件夹功能 ===

function closeCreateFolder() {
  if (creatingFolder.value) return
  showCreateFolder.value = false
  newFolderPath.value = ''
  newFolderName.value = ''
  createFolderError.value = ''
}

async function confirmCreateFolder() {
  const name = newFolderName.value.trim()
  if (!name) {
    createFolderError.value = '请输入文件夹名称'
    return
  }

  // 检查名称是否包含非法字符
  if (/[\/\\:*?"<>|]/.test(name)) {
    createFolderError.value = '文件夹名称不能包含 / \\ : * ? " < > | 等字符'
    return
  }

  creatingFolder.value = true
  createFolderError.value = ''

  try {
    const fullPath = newFolderPath.value + name
    await createFolder(fullPath)
    closeCreateFolder()
    loadFiles()
  } catch (err) {
    createFolderError.value = err.message || '创建失败，请检查权限配置'
  } finally {
    creatingFolder.value = false
  }
}
</script>

<style scoped>
.page-header {
  text-align: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 1.8rem;
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 0.9rem;
}

.header-actions {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  gap: 8px;
}

.btn-settings,
.btn-upload {
  background: #2a2a4a;
  border: 1px solid #444;
  color: #4ecdc4;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.btn-settings:hover,
.btn-upload:hover {
  background: #3a3a5a;
}

.btn-upload {
  color: #ffd93d;
  border-color: #ffd93d44;
}

.btn-upload:hover {
  background: #ffd93d22;
}

.btn-create-folder {
  background: #2a2a4a;
  border: 1px solid #444;
  color: #6bcb77;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.btn-create-folder:hover {
  background: #6bcb7722;
}

.page-header {
  position: relative;
}

.breadcrumb {
  background: #1a1a2e;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #2a2a4a;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.crumb {
  color: #4ecdc4;
  cursor: pointer;
  font-size: 0.9rem;
}

.crumb:hover {
  text-decoration: underline;
}

.crumb.current {
  color: #e0e0e0;
  cursor: default;
}

.crumb.current:hover {
  text-decoration: none;
}

.separator {
  color: #555;
}

.file-list {
  background: #1a1a2e;
  border-radius: 10px;
  border: 1px solid #2a2a4a;
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #2a2a4a;
  cursor: pointer;
  transition: background 0.2s;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background: #22223a;
}

.file-item.folder {
  background: #151525;
}

.file-item.folder:hover {
  background: #1a1a30;
}

.file-icon {
  font-size: 1.3rem;
}

.file-name {
  flex: 1;
  color: #e0e0e0;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: #666;
  font-size: 0.85rem;
}

.btn-download {
  background: transparent;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-download:hover {
  background: #2a2a4a;
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

.loading-state {
  text-align: center;
  padding: 60px 20px;
  color: #888;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #333;
  border-top-color: #4ecdc4;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-banner {
  background: #ff6b6b22;
  border: 1px solid #ff6b6b44;
  color: #ff6b6b;
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-banner button {
  background: #ff6b6b;
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.error-banner button:hover {
  background: #ff5252;
}

/* 预览弹窗 */
.preview-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
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

.preview-container {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #2a2a4a;
}

.preview-header h3 {
  font-size: 1.1rem;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

.btn-action {
  background: #2a2a4a;
  border: none;
  color: #4ecdc4;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-action:hover {
  background: #3a3a5a;
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

.preview-body {
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.preview-body img {
  max-width: 100%;
  max-height: 70vh;
  border-radius: 8px;
}

.preview-footer {
  padding: 12px 20px;
  border-top: 1px solid #2a2a4a;
  display: flex;
  justify-content: space-between;
  color: #888;
  font-size: 0.85rem;
}

/* 配置弹窗 */
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.settings-container {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  animation: slideUp 0.3s ease;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #2a2a4a;
}

.settings-header h2 {
  font-size: 1.2rem;
  color: #e0e0e0;
}

.settings-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 6px;
}

.form-group input,
.form-group select {
  width: 100%;
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #4ecdc4;
}

.settings-hint {
  font-size: 0.8rem;
  color: #666;
  margin-top: 8px;
  line-height: 1.5;
}

.settings-hint strong {
  color: #ffd93d;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #2a2a4a;
}

.btn-cancel {
  background: #2a2a4a;
  border: none;
  color: #ccc;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-cancel:hover {
  background: #3a3a5a;
}

.btn-save {
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
  border: none;
  color: #fff;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-save:hover {
  opacity: 0.85;
}

/* 上传弹窗 */
.upload-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.upload-container {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  width: 90%;
  max-width: 560px;
  animation: slideUp 0.3s ease;
}

.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #2a2a4a;
}

.upload-header h2 {
  font-size: 1.2rem;
  color: #e0e0e0;
}

.upload-body {
  padding: 20px;
}

.path-input-row {
  display: flex;
  gap: 8px;
}

.path-input {
  flex: 1;
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
}

.path-input:focus {
  border-color: #4ecdc4;
}

.btn-use-current {
  background: #2a2a4a;
  border: 1px solid #444;
  color: #ffd93d;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.btn-use-current:hover {
  background: #3a3a5a;
}

.path-hint {
  font-size: 0.75rem;
  color: #666;
  margin-top: 6px;
}

.file-drop-zone {
  border: 2px dashed #333;
  border-radius: 10px;
  min-height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  padding: 12px;
}

.file-drop-zone:hover {
  border-color: #555;
}

.file-drop-zone.drag-over {
  border-color: #ffd93d;
  background: rgba(255, 217, 61, 0.05);
}

.drop-hint {
  text-align: center;
  color: #666;
  pointer-events: none;
}

.drop-icon {
  font-size: 2rem;
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

.file-list-preview {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.upload-file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 6px;
  padding: 8px 10px;
}

.upload-file-item .file-icon {
  font-size: 1.1rem;
}

.upload-file-item .file-name {
  flex: 1;
  font-size: 0.85rem;
  color: #e0e0e0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-file-item .file-size {
  font-size: 0.75rem;
  color: #666;
}

.btn-remove-file {
  background: transparent;
  border: none;
  color: #ff6b6b;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-remove-file:hover {
  background: #ff6b6b22;
}

/* 上传进度 */
.upload-progress {
  margin-top: 16px;
  background: #0f0f1a;
  border: 1px solid #2a2a4a;
  border-radius: 8px;
  padding: 12px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 8px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #2a2a4a;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecdc4, #44a08d);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-filename {
  margin-top: 8px;
  font-size: 0.8rem;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #2a2a4a;
}

.btn-upload-confirm {
  background: linear-gradient(135deg, #ffd93d, #ff6b6b);
  border: none;
  color: #fff;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-upload-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-upload-confirm:not(:disabled):hover {
  opacity: 0.85;
}

/* 创建文件夹弹窗 */
.folder-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.folder-container {
  background: #1a1a2e;
  border: 1px solid #2a2a4a;
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  animation: slideUp 0.3s ease;
}

.folder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #2a2a4a;
}

.folder-header h2 {
  font-size: 1.2rem;
  color: #e0e0e0;
}

.folder-body {
  padding: 20px;
}

.error-inline {
  color: #ff6b6b;
  font-size: 0.85rem;
  margin-top: 8px;
}

.folder-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #2a2a4a;
}

.btn-create-confirm {
  background: linear-gradient(135deg, #6bcb77, #4ecdc4);
  border: none;
  color: #fff;
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
}

.btn-create-confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-create-confirm:not(:disabled):hover {
  opacity: 0.85;
}
</style>
