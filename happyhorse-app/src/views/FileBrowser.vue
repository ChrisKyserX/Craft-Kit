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
            <div class="secret-input-wrapper">
              <input
                v-model="settingsForm.secretKey"
                type="text"
                :class="['input-secret', { 'input-secret--visible': showSecretKey }]"
                placeholder="xxxxxxxxxxxxxxxx"
              />
              <button
                class="btn-toggle-secret"
                type="button"
                @click="showSecretKey = !showSecretKey"
                :title="showSecretKey ? '隐藏' : '显示'"
              >
                {{ showSecretKey ? '👁️' : '👁️‍🗨️' }}
              </button>
            </div>
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

    <!-- 文本弹窗（预览/编辑） -->
    <div v-if="editor.show" class="preview-overlay" @click.self="closeEditor">
      <div class="preview-container text-preview-container">
        <div class="preview-header">
          <h3>{{ editor.name }}</h3>
          <div class="preview-actions">
            <template v-if="editor.editing">
              <button class="btn-action btn-cancel-action" @click="cancelEdit">
                {{ cancelEditConfirm ? '确认取消' : '取消' }}
              </button>
              <button class="btn-action" @click="showSaveDialog = true">💾 保存</button>
            </template>
            <template v-else>
              <button v-if="editor.isHtml" class="btn-action" @click="previewHtml">🌐 效果预览</button>
              <button class="btn-action" @click="enterEditMode">✏️ 编辑</button>
            </template>
            <button class="btn-close" @click="closeEditor">✕</button>
          </div>
        </div>
        <div class="preview-body text-preview-body">
          <div v-if="editor.loading" class="loading-state">
            <div class="spinner"></div>
            <p>加载中...</p>
          </div>

          <!-- 预览模式 -->
          <div v-show="!editor.editing && !editor.loading" style="width: 100%;">
            <template v-if="htmlPreview">
              <div class="html-preview-bar">
                <button class="btn-action" @click="openHtmlInNewWindow">🔗 新窗口</button>
                <button class="btn-action btn-cancel-action" @click="htmlPreview = false">关闭预览</button>
              </div>
              <iframe
                :srcdoc="editor.content"
                class="html-preview-iframe"
                sandbox="allow-scripts allow-same-origin"
              ></iframe>
            </template>
            <template v-else>
              <div v-if="editor.isMarkdown" class="markdown-body" v-html="editor.rendered"></div>
              <pre v-else class="text-body">{{ editor.content }}</pre>
            </template>
          </div>

          <!-- 编辑模式 -->
          <div v-show="editor.editing" class="editor-wrapper">
            <div v-if="editor.isMarkdown" ref="milkdownContainer" class="milkdown-container"></div>
            <textarea
              v-else
              v-model="editor.content"
              class="text-editor"
              spellcheck="false"
            ></textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- 保存弹窗 -->
    <div v-if="showSaveDialog" class="save-overlay" @click.self="showSaveDialog = false">
      <div class="save-container">
        <div class="save-header">
          <h2>💾 保存文件</h2>
          <button class="btn-close" @click="showSaveDialog = false">✕</button>
        </div>
        <div class="save-body">
          <div class="form-group">
            <label class="radio-label">
              <input type="radio" v-model="saveMode" value="new" />
              <span>新建文件</span>
            </label>
            <label class="radio-label">
              <input type="radio" v-model="saveMode" value="overwrite" />
              <span>覆盖文件</span>
            </label>
          </div>

          <div v-if="saveMode === 'new'" class="form-group">
            <label>新文件名</label>
            <input
              v-model="saveNewName"
              type="text"
              class="save-name-input"
              placeholder="输入新文件名"
            />
            <p class="path-hint">保存到当前目录：{{ currentPath }}</p>
          </div>

          <div v-if="saveMode === 'overwrite'" class="form-group">
            <p class="overwrite-warning">⚠️ 将覆盖现有文件「{{ editor.name }}」，此操作不可撤销。</p>
          </div>

          <div v-if="saveError" class="error-inline">❌ {{ saveError }}</div>
        </div>
        <div class="save-footer">
          <button class="btn-cancel" @click="showSaveDialog = false" :disabled="saving">取消</button>
          <button
            class="btn-save"
            :disabled="saving"
            @click="saveMode === 'overwrite' ? confirmOverwrite() : doSave()"
          >
            {{ saveMode === 'overwrite' && !overwriteConfirmed ? '确认覆盖' : (saving ? '保存中...' : '保存') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, nextTick, watch } from 'vue'
import { listObjects, getCosConfig, saveCosConfig, uploadFile, createFolder, formatSize, saveFile } from '../api/cos.js'
import { marked } from 'marked'
import { Editor, defaultValueCtx, rootCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { nord } from '@milkdown/theme-nord'
import '@milkdown/theme-nord/style.css'
import { getMarkdown } from '@milkdown/utils'

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
const showSecretKey = ref(false)
const editor = ref({ show: false, name: '', content: '', rendered: '', isMarkdown: false, isHtml: false, editing: false, loading: false, key: '' })
const cancelEditConfirm = ref(false)
const htmlPreview = ref(false)
const milkdownContainer = ref(null)
let milkdownEditor = null

// 保存弹窗
const showSaveDialog = ref(false)
const saveMode = ref('new')
const saveNewName = ref('')
const saving = ref(false)
const saveError = ref('')
const overwriteConfirmed = ref(false)

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

async function selectFile(file) {
  if (file.isImage) {
    previewFile.value = file
  } else if (file.isText || file.isMarkdown) {
    editor.value = { show: true, name: file.name, content: '', rendered: '', isMarkdown: file.isMarkdown, isHtml: file.isHtml, editing: false, loading: true, key: file.key }
    try {
      const response = await fetch(file.url)
      const text = await response.text()
      editor.value.content = text
      editor.value.rendered = file.isMarkdown ? marked(text) : ''
      editor.value.loading = false

      if (file.isMarkdown) {
        await nextTick()
        initMilkdown(text)
      }
    } catch (err) {
      console.error('加载文件失败:', err)
      editor.value.content = '加载文件失败'
      editor.value.loading = false
    }
  }
}

async function enterEditMode() {
  editor.value.editing = true
  cancelEditConfirm.value = false
  if (editor.value.isMarkdown) {
    await nextTick()
    initMilkdown(editor.value.content)
  }
}

function cancelEdit() {
  if (!cancelEditConfirm.value) {
    cancelEditConfirm.value = true
    return
  }
  destroyMilkdown()
  editor.value.editing = false
  cancelEditConfirm.value = false
}

function previewHtml() {
  htmlPreview.value = true
}

function openHtmlInNewWindow() {
  const win = window.open('', '_blank')
  win.document.write(editor.value.content)
  win.document.close()
}

function initMilkdown(content) {
  destroyMilkdown()
  const container = milkdownContainer.value
  Editor.make()
    .config((ctx) => {
      nord(ctx)
      ctx.set(rootCtx, container)
      ctx.set(defaultValueCtx, content)
    })
    .use(commonmark)
    .create(container)
    .then(ed => {
      milkdownEditor = ed
    })
}

function destroyMilkdown() {
  if (milkdownEditor) {
    milkdownEditor.destroy()
    milkdownEditor = null
  }
}

function closeEditor() {
  destroyMilkdown()
  cancelEditConfirm.value = false
  htmlPreview.value = false
  editor.value = { show: false, name: '', content: '', rendered: '', isMarkdown: false, isHtml: false, editing: false, loading: false, key: '' }
}

function getEditorContent() {
  if (editor.value.isMarkdown && milkdownEditor) {
    return getMarkdown()(milkdownEditor.ctx) || ''
  }
  return editor.value.content
}

// 打开保存弹窗时初始化状态
watch(showSaveDialog, (val) => {
  if (val) {
    saveMode.value = 'new'
    saveError.value = ''
    overwriteConfirmed.value = false
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const dotIndex = editor.value.name.lastIndexOf('.')
    if (dotIndex > 0) {
      saveNewName.value = editor.value.name.slice(0, dotIndex) + '-' + dateStr + editor.value.name.slice(dotIndex)
    } else {
      saveNewName.value = editor.value.name + '-' + dateStr
    }
  }
})

function confirmOverwrite() {
  if (!overwriteConfirmed.value) {
    overwriteConfirmed.value = true
    return
  }
  doSave()
}

async function doSave() {
  const content = getEditorContent()
  saveError.value = ''

  let key
  if (saveMode.value === 'new') {
    if (!saveNewName.value.trim()) {
      saveError.value = '请输入文件名'
      return
    }
    key = currentPath.value + saveNewName.value.trim()
  } else {
    if (!overwriteConfirmed.value) {
      saveError.value = '请再次点击确认覆盖'
      return
    }
    key = editor.value.key
  }

  saving.value = true
  try {
    await saveFile(key, content)
    showSaveDialog.value = false
    closeEditor()
    loadFiles()
  } catch (err) {
    saveError.value = err.message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function downloadFile(file) {
  try {
    const response = await fetch(file.url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    console.error('下载失败:', err)
    errorMsg.value = `下载 "${file.name}" 失败`
  }
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
  background: linear-gradient(135deg, #444, #333);
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
  background: #333333;
  border: 1px solid #444;
  color: #aaa;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.btn-settings:hover,
.btn-upload:hover {
  background: #555555;
}

.btn-upload {
  color: #888;
  border-color: #88844;
}

.btn-upload:hover {
  background: #88888822;
}

.btn-create-folder {
  background: #333333;
  border: 1px solid #444;
  color: #888;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.2s;
}

.btn-create-folder:hover {
  background: #88888822;
}

.page-header {
  position: relative;
}

.breadcrumb {
  background: #1e1e1e;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #333333;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.crumb {
  color: #aaa;
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
  background: #1e1e1e;
  border-radius: 10px;
  border: 1px solid #333333;
  overflow: hidden;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #333333;
  cursor: pointer;
  transition: background 0.2s;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover {
  background: #2a2a2a;
}

.file-item.folder {
  background: #1a1a1a;
}

.file-item.folder:hover {
  background: #252525;
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
  background: #333333;
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
  border-top-color: #aaa;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-banner {
  background: #cc444422;
  border: 1px solid #cc444444;
  color: #cc4444;
  padding: 12px 16px;
  border-radius: 8px;
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-banner button {
  background: #cc4444;
  border: none;
  color: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.error-banner button:hover {
  background: #cc4444;
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
  background: #1e1e1e;
  border: 1px solid #333333;
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
  border-bottom: 1px solid #333333;
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
  background: #333333;
  border: none;
  color: #aaa;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-action:hover {
  background: #555555;
}

.btn-cancel-action {
  color: #888;
}

.btn-cancel-action:hover {
  background: #55555522;
}

.btn-close {
  background: #333333;
  border: none;
  color: #ccc;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-close:hover {
  background: #555555;
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
  border-top: 1px solid #333333;
  display: flex;
  justify-content: space-between;
  color: #888;
  font-size: 0.85rem;
}

/* 文本预览 */
.text-preview-container {
  max-width: 800px;
}

.text-preview-body {
  padding: 24px;
  justify-content: flex-start;
  align-items: stretch;
}

.text-body {
  color: #ccc;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  width: 100%;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}

.markdown-body {
  color: #ccc;
  font-size: 0.95rem;
  line-height: 1.7;
  width: 100%;
}

.markdown-body :deep(h1) { font-size: 1.6rem; color: #e0e0e0; margin: 16px 0 8px; }
.markdown-body :deep(h2) { font-size: 1.3rem; color: #e0e0e0; margin: 14px 0 6px; }
.markdown-body :deep(h3) { font-size: 1.1rem; color: #e0e0e0; margin: 12px 0 4px; }
.markdown-body :deep(p) { margin: 8px 0; }
.markdown-body :deep(code) { background: #111111; padding: 2px 6px; border-radius: 4px; font-size: 0.85rem; color: #aaa; }
.markdown-body :deep(pre) { background: #111111; padding: 16px; border-radius: 8px; overflow-x: auto; }
.markdown-body :deep(pre code) { background: none; padding: 0; color: #ccc; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 24px; margin: 8px 0; }
.markdown-body :deep(li) { margin: 4px 0; }
.markdown-body :deep(a) { color: #aaa; }
.markdown-body :deep(blockquote) { border-left: 3px solid #666; padding-left: 12px; margin: 8px 0; color: #777; }
.markdown-body :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.markdown-body :deep(th), .markdown-body :deep(td) { border: 1px solid #333333; padding: 8px 12px; text-align: left; }
.markdown-body :deep(th) { background: #111111; color: #e0e0e0; }
.markdown-body :deep(hr) { border: none; border-top: 1px solid #333333; margin: 16px 0; }

/* HTML 预览 */
.html-preview-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.html-preview-iframe {
  width: 100%;
  min-height: 500px;
  border: 1px solid #333333;
  border-radius: 8px;
  background: #fff;
}

/* 编辑器 */
.editor-wrapper {
  width: 100%;
  min-height: 400px;
}

.milkdown-container {
  min-height: 400px;
  color: #ccc;
  font-size: 0.95rem;
  line-height: 1.7;
}

.milkdown-container :deep(.milkdown) {
  background: #111111;
  color: #ccc;
}

.milkdown-container :deep(.ProseMirror) {
  background: #111111;
  color: #ccc;
  min-height: 400px;
  padding: 16px;
  outline: none;
}

.milkdown-container :deep(.ProseMirror) h1,
.milkdown-container :deep(.ProseMirror) h2,
.milkdown-container :deep(.ProseMirror) h3,
.milkdown-container :deep(.ProseMirror) h4,
.milkdown-container :deep(.ProseMirror) h5,
.milkdown-container :deep(.ProseMirror) h6 {
  color: #e0e0e0;
}

.milkdown-container :deep(.ProseMirror) code {
  background: #1e1e1e;
  color: #aaa;
}

.milkdown-container :deep(.ProseMirror) pre {
  background: #1e1e1e;
}

.milkdown-container :deep(.ProseMirror) pre code {
  color: #ccc;
}

.milkdown-container :deep(.ProseMirror) blockquote {
  border-left-color: #555;
  color: #888;
}

.milkdown-container :deep(.ProseMirror) a {
  color: #aaa;
}

.milkdown-container :deep(.editor) {
  padding: 0;
  outline: none;
  min-height: 400px;
}

.text-editor {
  width: 100%;
  min-height: 400px;
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 16px;
  color: #ccc;
  font-size: 0.9rem;
  line-height: 1.6;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  resize: vertical;
  outline: none;
}

.text-editor:focus {
  border-color: #aaa;
}

/* 保存弹窗 */
.save-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1100;
  animation: fadeIn 0.2s ease;
}

.save-container {
  background: #1e1e1e;
  border: 1px solid #333333;
  border-radius: 12px;
  width: 90%;
  max-width: 440px;
  animation: slideUp 0.3s ease;
}

.save-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #333333;
}

.save-header h2 {
  font-size: 1.2rem;
  color: #e0e0e0;
}

.save-body {
  padding: 20px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #ccc;
  font-size: 0.95rem;
  padding: 8px 0;
}

.radio-label input[type="radio"] {
  accent-color: #aaa;
  width: 16px;
  height: 16px;
}

.save-name-input {
  width: 100%;
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
}

.save-name-input:focus {
  border-color: #aaa;
}

.overwrite-warning {
  color: #888;
  font-size: 0.85rem;
  padding: 8px 0;
}

.save-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #333333;
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
  background: #1e1e1e;
  border: 1px solid #333333;
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
  border-bottom: 1px solid #333333;
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
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #aaa;
}

.settings-hint {
  font-size: 0.8rem;
  color: #666;
  margin-top: 8px;
  line-height: 1.5;
}

.settings-hint strong {
  color: #888;
}

.secret-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.secret-input-wrapper .input-secret {
  padding-right: 40px;
}

.input-secret {
  -webkit-text-security: disc;
}

.input-secret.input-secret--visible {
  -webkit-text-security: none;
}

.btn-toggle-secret {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  line-height: 1;
}

.btn-toggle-secret:hover {
  background: #333333;
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #333333;
}

.btn-cancel {
  background: #333333;
  border: none;
  color: #ccc;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-cancel:hover {
  background: #555555;
}

.btn-save {
  background: linear-gradient(135deg, #444, #333);
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
  background: #1e1e1e;
  border: 1px solid #333333;
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
  border-bottom: 1px solid #333333;
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
  background: #111111;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
}

.path-input:focus {
  border-color: #aaa;
}

.btn-use-current {
  background: #333333;
  border: 1px solid #444;
  color: #888;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.btn-use-current:hover {
  background: #555555;
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
  border-color: #888;
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
  background: #111111;
  border: 1px solid #333333;
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
  color: #cc4444;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-remove-file:hover {
  background: #cc444422;
}

/* 上传进度 */
.upload-progress {
  margin-top: 16px;
  background: #111111;
  border: 1px solid #333333;
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
  background: #333333;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #555, #444);
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
  border-top: 1px solid #333333;
}

.btn-upload-confirm {
  background: linear-gradient(135deg, #555, #333);
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
  background: #1e1e1e;
  border: 1px solid #333333;
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
  border-bottom: 1px solid #333333;
}

.folder-header h2 {
  font-size: 1.2rem;
  color: #e0e0e0;
}

.folder-body {
  padding: 20px;
}

.error-inline {
  color: #cc4444;
  font-size: 0.85rem;
  margin-top: 8px;
}

.folder-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #333333;
}

.btn-create-confirm {
  background: linear-gradient(135deg, #444, #555);
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
