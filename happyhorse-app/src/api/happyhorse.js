import axios from 'axios'

// 开发环境走 Vite 代理，生产环境直接调用 DashScope
const BASE_URL = import.meta.env.DEV
  ? '/api/v1'
  : 'https://dashscope.aliyuncs.com/api/v1'

// 创建 axios 实例
function createClient(apiKey) {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable'
    }
  })
}

/**
 * 文生视频 - 创建任务
 */
export async function createTextToVideoTask(apiKey, params) {
  const client = createClient(apiKey)
  const body = {
    model: 'happyhorse-1.0-t2v',
    input: {
      prompt: params.prompt
    },
    parameters: {}
  }

  if (params.size) body.parameters.size = params.size
  if (params.duration) body.parameters.duration = params.duration
  if (params.resolution) body.parameters.resolution = params.resolution
  if (params.prompt_extend !== undefined) body.parameters.prompt_extend = params.prompt_extend
  if (params.seed !== undefined && params.seed !== '') body.parameters.seed = Number(params.seed)

  console.log('[HappyHorse T2V] Request body:', JSON.stringify(body, null, 2))

  try {
    const { data } = await client.post('/services/aigc/video-generation/video-synthesis', body)
    console.log('[HappyHorse T2V] Response:', data)
    return data.output
  } catch (err) {
    console.error('[HappyHorse T2V] Error status:', err.response?.status)
    console.error('[HappyHorse T2V] Error data:', err.response?.data)
    throw err
  }
}

/**
 * 图生视频 - 创建任务
 */
export async function createImageToVideoTask(apiKey, params) {
  const client = createClient(apiKey)
  const body = {
    model: 'happyhorse-1.0-i2v',
    input: {
      prompt: params.prompt || '',
      media: [
        {
          type: 'first_frame',
          url: params.imageUrl
        }
      ]
    },
    parameters: {}
  }

  if (params.size) body.parameters.size = params.size
  if (params.duration) body.parameters.duration = params.duration
  if (params.prompt_extend !== undefined) body.parameters.prompt_extend = params.prompt_extend

  console.log('[HappyHorse I2V] Request body:', JSON.stringify(body, null, 2))

  try {
    const { data } = await client.post('/services/aigc/video-generation/video-synthesis', body)
    console.log('[HappyHorse I2V] Response:', data)
    return data.output
  } catch (err) {
    console.error('[HappyHorse I2V] Error status:', err.response?.status)
    console.error('[HappyHorse I2V] Error data:', err.response?.data)
    throw err
  }
}

/**
 * 查询任务状态
 */
export async function queryTask(apiKey, taskId) {
  const client = createClient(apiKey)
  client.defaults.headers['X-DashScope-Async'] = undefined
  const { data } = await client.get(`/tasks/${taskId}`)
  return data.output
}

/**
 * 轮询任务直到完成
 */
export async function pollTaskUntilDone(apiKey, taskId, onProgress, interval = 5000) {
  const terminalStates = ['SUCCEEDED', 'FAILED']
  while (true) {
    const output = await queryTask(apiKey, taskId)
    if (onProgress) onProgress(output)
    if (terminalStates.includes(output.task_status)) {
      return output
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }
}
