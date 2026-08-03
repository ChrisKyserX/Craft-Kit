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
            ⬇️ 下载
          </a>
          <button class="btn-close" @click="$emit('close')">✕</button>
        </div>
      </div>

      <div class="modal-body">
        <!-- 视频播放 -->
        <div v-if="item.videoUrl" class="video-section">
          <video :src="item.videoUrl" controls autoplay loop></video>
        </div>

        <!-- 详情信息 -->
        <div class="detail-section">
          <div class="detail-row" v-if="item.prompt">
            <label>提示词</label>
            <p>{{ item.prompt }}</p>
          </div>
          <div class="detail-row" v-if="item.imageUrl">
            <label>首帧图片</label>
            <img :src="item.imageUrl" alt="首帧" class="preview-img" />
          </div>
          <div class="detail-row" v-if="item.type">
            <label>生成类型</label>
            <span class="tag">{{ item.type === 'text-to-video' ? '文生视频' : '图生视频' }}</span>
          </div>
          <div class="detail-row" v-if="item.params">
            <label>参数</label>
            <div class="params-list">
              <span v-if="item.params.size" class="param-tag">{{ item.params.size }}</span>
              <span v-if="item.params.duration" class="param-tag">{{ item.params.duration }}秒</span>
              <span v-if="item.params.resolution" class="param-tag">{{ item.params.resolution }}</span>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  item: { type: Object, required: true }
})

defineEmits(['close'])

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
