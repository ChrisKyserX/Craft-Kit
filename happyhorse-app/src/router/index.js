import { createRouter, createWebHistory } from 'vue-router'
import VideoGenerator from '../views/VideoGenerator.vue'
import FileBrowser from '../views/FileBrowser.vue'
import AgentChat from '../views/AgentChat.vue'
import SettingsPage from '../views/SettingsPage.vue'

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
  },
  {
    path: '/agent',
    name: 'agent',
    component: AgentChat
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage
  }
]

const router = createRouter({
  history: createWebHistory('/testpage/'),
  routes
})

export default router
