<template>
  <div class="video-result">
    <div class="result-header">
      <span>🎉 生成结果</span>
      <a :href="videoUrl" target="_blank" rel="noopener" class="download-link">
        在新标签页打开 ↗
      </a>
    </div>
    <div class="video-wrapper">
      <video :src="videoUrl" controls autoplay loop></video>
    </div>
  </div>
</template>

<script setup>
defineProps({
  videoUrl: { type: String, required: true }
})
</script>

<style scoped>
.video-result {
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

.download-link {
  font-size: 0.85rem;
  color: #999;
  text-decoration: none;
}

.download-link:hover {
  text-decoration: underline;
}

.video-wrapper {
  padding: 12px;
}

.video-wrapper video {
  width: 100%;
  border-radius: 8px;
  background: #000;
  max-height: 450px;
}
</style>
