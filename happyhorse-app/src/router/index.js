import { createRouter, createWebHistory } from 'vue-router'
import VideoGenerator from '../views/VideoGenerator.vue'
import FileBrowser from '../views/FileBrowser.vue'

const routes = [
  {
    path: '/',
    name: 'video',
    component: VideoGenerator
  },
  {
    path: '/files',
    name: 'files',
    component: FileBrowser
  }
]

const router = createRouter({
  history: createWebHistory('/testpage/'),
  routes
})

export default router
