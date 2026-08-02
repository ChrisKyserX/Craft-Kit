import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/testpage/',
  plugins: [vue()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // DashScope API 代理
      '/api/v1': {
        target: 'https://dashscope.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path
      },
      // 腾讯云 COS 代理（可选，需修改 src/config/cos.js 开启 proxyMode）
      '/api/cos': {
        target: 'https://your-bucket.cos.ap-beijing.myqcloud.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cos/, '')
      }
    }
  }
})
