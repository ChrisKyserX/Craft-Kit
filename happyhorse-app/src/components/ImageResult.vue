<template>
  <div class="image-result">
    <div class="result-header">
      <span>🎉 生成结果</span>
      <span class="result-count" v-if="imageUrls.length > 1">{{ imageUrls.length }} 张图片</span>
      <a :href="imageUrls[0]" target="_blank" rel="noopener" class="download-link">
        在新标签页打开 ↗
      </a>
    </div>
    <div :class="imageUrls.length > 1 ? 'image-grid' : 'image-wrapper'">
      <div v-for="(url, index) in imageUrls" :key="index" class="image-card">
        <img :src="url" :alt="`生成的图片 ${index + 1}`" />
        <div class="image-actions">
          <a :href="url" target="_blank" rel="noopener" class="btn-img-action" title="新标签页打开">
            🔗
          </a>
          <button class="btn-img-action" @click="downloadImage(url, index)" title="下载图片">
            ⬇️
          </button>
        </div>
      </div>
    </div>
    <div class="result-footer">
      <p class="expire-note">⚠️ 图片链接有效期 24 小时，请及时下载保存</p>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  imageUrls: { type: Array, required: true }
})

async function downloadImage(url, index) {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = `happyhorse-image-${Date.now()}-${index + 1}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  } catch (err) {
    console.error('下载失败:', err)
    // 降级：直接打开
    window.open(url, '_blank')
  }
}
</script>

<style scoped>
.image-result {
  background: #222222;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
  overflow: hidden;
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #3a3a3a;
  font-weight: 500;
}

.result-count {
  font-size: 0.8rem;
  color: #999;
  margin-left: auto;
  margin-right: 16px;
}

.download-link {
  font-size: 0.85rem;
  color: #999;
  text-decoration: none;
}

.download-link:hover {
  text-decoration: underline;
}

.image-wrapper {
  padding: 12px;
  display: flex;
  justify-content: center;
}

.image-wrapper img {
  max-width: 100%;
  max-height: 500px;
  border-radius: 8px;
}

.image-grid {
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.image-card {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #111111;
}

.image-card img {
  width: 100%;
  height: auto;
  display: block;
  min-height: 200px;
  object-fit: cover;
}

.image-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-card:hover .image-actions {
  opacity: 1;
}

.btn-img-action {
  background: rgba(0, 0, 0, 0.6);
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  transition: background 0.2s;
}

.btn-img-action:hover {
  background: rgba(0, 0, 0, 0.8);
}

.result-footer {
  padding: 8px 16px;
  border-top: 1px solid #3a3a3a;
}

.expire-note {
  font-size: 0.75rem;
  color: #bbbbbb55;
}
</style>