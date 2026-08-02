const HISTORY_KEY = 'happyhorse_history'

/**
 * 获取所有历史记录
 */
export function getHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * 添加历史记录
 */
export function addHistory(item) {
  const history = getHistory()
  const record = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: new Date().toISOString(),
    ...item
  }
  history.unshift(record) // 最新的在前面
  // 最多保存 100 条
  if (history.length > 100) history.length = 100
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return record
}

/**
 * 删除历史记录
 */
export function removeHistory(id) {
  const history = getHistory().filter(item => item.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

/**
 * 清空所有历史记录
 */
export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

/**
 * 标记某条记录为已上传到 COS
 */
export function markUploaded(id) {
  const history = getHistory()
  const item = history.find(i => i.id === id)
  if (item) {
    item.cosUploaded = true
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
}
