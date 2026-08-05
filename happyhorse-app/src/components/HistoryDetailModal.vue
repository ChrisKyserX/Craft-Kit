<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-container">
      <div class="modal-header">
        <h2>📋 详情</h2>
        <div class="header-actions">
          <a
            v-if="item.videoUrl"
            :href="item.videoUrl"
            target="_blank"
            rel="noopener"
            class="btn-action"
            download
          >
            ⬇️ 下载视频
          </a>
          <a
            v-if="item.imageUrl && !item.videoUrl"
            :href="item.imageUrl"
            target="_blank"
            rel="noopener"
            class="btn-action"
            download
          >
            ⬇️ 下载图片
          </a>
          <button class="btn-close" @click="$emit('close')">✕</button>
        </div>
      </div>

      <div class="modal-body">
        <!-- 视频播放 -->
        <div v-if="item.videoUrl" class="video-section">
          <video :src="item.videoUrl" controls autoplay loop></video>
        </div>

        <!-- 图片展示 -->
        <div v-if="item.imageUrls && item.imageUrls.length > 0" class="image-section">
          <div :class="item.imageUrls.length > 1 ? 'image-grid' : 'image-single'">
            <div v-for="(url, i) in item.imageUrls" :key="i" class="image-card">
              <img :src="url" :alt="`图片 ${i + 1}`" />
            </div>
          </div>
        </div>
        <div v-else-if="item.imageUrl && !item.imageUrls" class="image-section">
          <div class="image-single">
            <img :src="item.imageUrl" alt="生成的图片" />
          </div>
        </div>

        <!-- 详情信息 -->
        <div class="detail-section">
          <!-- 输入图片 -->
          <div class="detail-row" v-if="item.inputImageUrl">
            <label>参考图片</label>
            <img :src="item.inputImageUrl" alt="参考图片" class="preview-img" />
          </div>
          <div class="detail-row" v-if="item.prompt">
            <label>提示词</label>
            <p>{{ item.prompt }}</p>
          </div>
          <div class="detail-row" v-if="item.imageUrl && item.category === 'video'">
            <label>首帧图片</label>
            <img :src="item.imageUrl" alt="首帧" class="preview-img" />
          </div>
          <div class="detail-row" v-if="item.type">
            <label>生成类型</label>
            <span class="tag">{{ typeLabel }}</span>
          </div>
          <div class="detail-row" v-if="item.modelName">
            <label>模型</label>
            <span class="tag">{{ item.modelName }}</span>
          </div>
          <div class="detail-row" v-if="item.params">
            <label>参数</label>
            <div class="params-list">
              <span v-if="item.params.size" class="param-tag">{{ item.params.size }}</span>
              <span v-if="item.params.duration" class="param-tag">{{ item.params.duration }}秒</span>
              <span v-if="item.params.resolution" class="param-tag">{{ item.params.resolution }}</span>
              <span v-if="item.params.n && item.params.n > 1" class="param-tag">{{ item.params.n }}张</span>
              <span v-if="item.params.promptExtend !== undefined" class="param-tag">提示词扩展: {{ item.params.promptExtend ? '开' : '关' }}</span>
              <span v-if="item.params.thinkingMode !== undefined" class="param-tag">思考模式: {{ item.params.thinkingMode ? '开' : '关' }}</span>
              <span v-if="item.params.watermark" class="param-tag">水印: 开</span>
            </div>
          </div>
          <div class="detail-row" v-if="item.taskId">
            <label>任务 ID</label>
            <code class="task-id">{{ item.taskId }}</code>
          </div>
          <div class="detail-row" v-if="item.createdAt">
            <label>创建时间</label>
            <span>{{ formatDateTime(item.createdAt) }}</span>
          </div>
          <div class="detail-row" v-if="item.videoUrl">
            <label>视频链接</label>
            <a :href="item.videoUrl" target="_blank" rel="noopener" class="video-link">
              {{ item.videoUrl }}
            </a>
          </div>
          <div class="detail-row" v-if="item.imageUrl && item.category === 'image'">
            <label>图片链接</label>
            <a :href="item.imageUrl" target="_blank" rel="noopener" class="video-link">
              {{ item.imageUrl }}
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: { type: Object, required: true }
})

defineEmits(['close'])

const typeLabel = computed(() => {
  const t = props.item.type
  if (t === 'text-to-video') return '文生视频'
  if (t === 'image-to-video') return '图生视频'
  if (t === 'text-to-image') return '文生图'
  if (t === 'image-to-image') return '图生图'
  return t
})

function formatDateTime(isoStr) {
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
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
  z-index: 1100;
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
  max-width: 700px;
  max-height: 90vh;
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

.modal-header h2 {
  font-size: 1.2rem;
  color: #f0f0f0;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-action {
  background: #3a3a3a;
  border: none;
  color: #999;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
  text-decoration: none;
}

.btn-action:hover {
  background: #555555;
}

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

.btn-close:hover {
  background: #555555;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.video-section {
  margin-bottom: 20px;
}

.video-section video {
  width: 100%;
  border-radius: 10px;
  background: #000;
  max-height: 360px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row label {
  font-size: 0.8rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-row p {
  color: #f0f0f0;
  font-size: 0.95rem;
  line-height: 1.5;
  word-break: break-word;
}

.preview-img {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  border: 1px solid #333;
}

/* 图片展示 */
.image-section {
  margin-bottom: 20px;
}

.image-single {
  display: flex;
  justify-content: center;
}

.image-single img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 10px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.image-grid .image-card {
  border-radius: 8px;
  overflow: hidden;
  background: #111111;
}

.image-grid .image-card img {
  width: 100%;
  height: auto;
  display: block;
  min-height: 150px;
  object-fit: cover;
}

.tag {
  display: inline-block;
  background: #3a3a3a;
  color: #999;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.params-list {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.param-tag {
  background: #111111;
  border: 1px solid #333;
  color: #ddd;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.task-id {
  color: #999;
  font-size: 0.85rem;
  word-break: break-all;
}

.video-link {
  color: #999;
  font-size: 0.85rem;
  word-break: break-all;
  text-decoration: none;
}

.video-link:hover {
  text-decoration: underline;
}
</style>
