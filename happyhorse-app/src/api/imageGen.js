import axios from 'axios'

// 开发环境走 Vite 代理，生产环境直接调用 DashScope
const BASE_URL = import.meta.env.DEV
  ? '/api/v1'
  : 'https://dashscope.aliyuncs.com/api/v1'

// ============================================================
// 模型配置
// ============================================================

export const IMAGE_MODELS = {
  qwen: [
    { id: 'qwen-image-3.0-pro', name: 'Qwen Image 3.0 Pro', desc: '最新旗舰，文本渲染最强', sync: true, endpoint: 'multimodal-generation' },
    { id: 'qwen-image-3.0', name: 'Qwen Image 3.0', desc: '均衡版', sync: true, endpoint: 'multimodal-generation' },
    { id: 'qwen-image-2.0-pro', name: 'Qwen Image 2.0 Pro', desc: '稳定版', sync: true, endpoint: 'multimodal-generation' },
    { id: 'qwen-image-max', name: 'Qwen Image Max', desc: '最大效果', sync: true, endpoint: 'multimodal-generation' },
    { id: 'qwen-image-plus', name: 'Qwen Image Plus', desc: '增强版', sync: true, endpoint: 'multimodal-generation' },
    { id: 'qwen-image', name: 'Qwen Image', desc: '基础版', sync: true, endpoint: 'multimodal-generation' },
  ],
  wan: [
    { id: 'wan2.7-image-pro', name: 'Wan 2.7 Pro', desc: '最高分辨率 4096×4096', sync: false, endpoint: 'image-generation' },
    { id: 'wan2.7-image', name: 'Wan 2.7', desc: '均衡版', sync: false, endpoint: 'image-generation' },
    { id: 'wan2.6-t2i', name: 'Wan 2.6 T2I', desc: '稳定版', sync: false, endpoint: 'image-generation' },
    { id: 'wan2.2-t2i-plus', name: 'Wan 2.2 T2I Plus', desc: '增强版', sync: false, endpoint: 'image-generation' },
    { id: 'wan2.2-t2i-flash', name: 'Wan 2.2 T2I Flash', desc: '快速版', sync: false, endpoint: 'image-generation' },
    { id: 'wan2.1-t2i-plus', name: 'Wan 2.1 T2I Plus', desc: '经典版', sync: false, endpoint: 'image-generation' },
    { id: 'wan2.1-t2i-turbo', name: 'Wan 2.1 T2I Turbo', desc: '极速版', sync: false, endpoint: 'image-generation' },
  ],
  zimage: [
    { id: 'z-image-turbo', name: 'Z Image Turbo', desc: '极速生成，价格最低', sync: true, endpoint: 'multimodal-generation' },
  ]
}

/**
 * 获取所有模型平铺列表
 */
export function getAllModels() {
  const all = []
  for (const group of Object.keys(IMAGE_MODELS)) {
    all.push(...IMAGE_MODELS[group])
  }
  return all
}

/**
 * 根据 model ID 查找模型配置
 */
export function findModel(modelId) {
  return getAllModels().find(m => m.id === modelId)
}

// ============================================================
// API 客户端
// ============================================================

function createClient(apiKey, asyncMode = false) {
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  if (asyncMode) {
    headers['X-DashScope-Async'] = 'enable'
  }
  return axios.create({
    baseURL: BASE_URL,
    headers
  })
}

// ============================================================
// 构建请求体
// ============================================================

/**
 * 构建文生图请求体
 */
function buildT2IBody(modelConfig, params) {
  const body = {
    model: modelConfig.id,
    input: {
      messages: [
        {
          role: 'user',
          content: [
            { text: params.prompt }
          ]
        }
      ]
    },
    parameters: {}
  }

  if (params.size) body.parameters.size = params.size
  if (params.n !== undefined && params.n > 1) body.parameters.n = params.n

  // Qwen / Z-Image 同步模型的参数
  if (modelConfig.sync) {
    if (params.prompt_extend !== undefined) body.parameters.prompt_extend = params.prompt_extend
    if (params.prompt_extend_mode) body.parameters.prompt_extend_mode = params.prompt_extend_mode
  }

  // Wan 异步模型的参数
  if (!modelConfig.sync) {
    if (params.thinking_mode !== undefined) body.parameters.thinking_mode = params.thinking_mode
    if (params.watermark !== undefined) body.parameters.watermark = params.watermark
    if (params.negative_prompt) body.parameters.negative_prompt = params.negative_prompt
  }

  return body
}

/**
 * 构建图生图请求体
 */
function buildI2IBody(modelConfig, params) {
  const content = []

  // 参考图片在前
  if (params.imageUrl) {
    content.push({ image: params.imageUrl })
  }

  // 提示词在后
  if (params.prompt) {
    content.push({ text: params.prompt })
  }

  const body = {
    model: modelConfig.id,
    input: {
      messages: [
        {
          role: 'user',
          content
        }
      ]
    },
    parameters: {}
  }

  if (params.size) body.parameters.size = params.size

  // Qwen / Z-Image 同步模型参数
  if (modelConfig.sync) {
    if (params.prompt_extend !== undefined) body.parameters.prompt_extend = params.prompt_extend
  }

  // Wan 异步模型参数
  if (!modelConfig.sync) {
    if (params.thinking_mode !== undefined) body.parameters.thinking_mode = params.thinking_mode
    if (params.watermark !== undefined) body.parameters.watermark = params.watermark
  }

  return body
}

// ============================================================
// 同步调用（Qwen / Z-Image）
// ============================================================

/**
 * 同步图片生成 (Qwen / Z-Image)
 * @param {string} apiKey
 * @param {object} modelConfig - 模型配置对象
 * @param {object} params - { prompt, imageUrl?, size?, prompt_extend? }
 * @returns {Promise<{images: string[]}>} 返回图片 URL 数组
 */
export async function createSyncImageTask(apiKey, modelConfig, params) {
  const client = createClient(apiKey, false)
  const endpoint = `/services/aigc/${modelConfig.endpoint}/generation`
  const isI2I = !!params.imageUrl

  const body = isI2I ? buildI2IBody(modelConfig, params) : buildT2IBody(modelConfig, params)

  console.log(`[ImageGen ${modelConfig.id}] Request body:`, JSON.stringify(body, null, 2))

  try {
    const { data } = await client.post(endpoint, body)
    console.log(`[ImageGen ${modelConfig.id}] Response:`, data)

    // 提取图片 URL
    const images = []
    if (data.output && data.output.choices) {
      for (const choice of data.output.choices) {
        if (choice.message && choice.message.content) {
          for (const item of choice.message.content) {
            if (item.image) {
              images.push(item.image)
            }
          }
        }
      }
    }

    return { images, requestId: data.request_id, usage: data.usage }
  } catch (err) {
    console.error(`[ImageGen ${modelConfig.id}] Error status:`, err.response?.status)
    console.error(`[ImageGen ${modelConfig.id}] Error data:`, err.response?.data)
    throw err
  }
}

// ============================================================
// 异步调用（Wan）
// ============================================================

/**
 * 异步图片生成 - 创建任务 (Wan)
 * @param {string} apiKey
 * @param {object} modelConfig - 模型配置对象
 * @param {object} params - { prompt, imageUrl?, size?, n?, watermark?, thinking_mode? }
 * @returns {Promise<object>} { task_id, task_status }
 */
export async function createAsyncImageTask(apiKey, modelConfig, params) {
  const client = createClient(apiKey, true)
  const endpoint = `/services/aigc/${modelConfig.endpoint}/generation`
  const isI2I = !!params.imageUrl

  const body = isI2I ? buildI2IBody(modelConfig, params) : buildT2IBody(modelConfig, params)

  console.log(`[ImageGen ${modelConfig.id}] Request body:`, JSON.stringify(body, null, 2))

  try {
    const { data } = await client.post(endpoint, body)
    console.log(`[ImageGen ${modelConfig.id}] Response:`, data)
    return data.output
  } catch (err) {
    console.error(`[ImageGen ${modelConfig.id}] Error status:`, err.response?.status)
    console.error(`[ImageGen ${modelConfig.id}] Error data:`, err.response?.data)
    throw err
  }
}

// ============================================================
// 统一入口：根据模型配置自动选择同步/异步
// ============================================================

/**
 * 统一的图片生成调用入口
 * 根据 modelConfig.sync 自动选择同步或异步方式
 *
 * @param {string} apiKey
 * @param {object} modelConfig - 模型配置对象（来自 IMAGE_MODELS）
 * @param {object} params - { prompt, imageUrl?, size?, ... }
 * @returns {Promise<{sync: boolean, images?: string[], taskId?: string}>}
 *   - sync=true: 返回 { sync: true, images: [...], requestId, usage }
 *   - sync=false: 返回 { sync: false, taskId, taskStatus }
 */
export async function createImageTask(apiKey, modelConfig, params) {
  if (modelConfig.sync) {
    const result = await createSyncImageTask(apiKey, modelConfig, params)
    return { sync: true, ...result }
  } else {
    const output = await createAsyncImageTask(apiKey, modelConfig, params)
    return { sync: false, taskId: output.task_id, taskStatus: output.task_status }
  }
}

// ============================================================
// 任务查询（复用 happyhorse.js 的模式）
// ============================================================

/**
 * 查询任务状态
 */
export async function queryTask(apiKey, taskId) {
  const client = createClient(apiKey, false)
  // 查询任务时不需要 async header
  delete client.defaults.headers['X-DashScope-Async']
  const { data } = await client.get(`/tasks/${taskId}`)
  return data.output
}

/**
 * 轮询任务直到完成
 * @param {string} apiKey
 * @param {string} taskId
 * @param {function} onProgress - 进度回调 (output) => void
 * @param {number} interval - 轮询间隔(ms)，默认 5000
 * @returns {Promise<object>} 最终的任务输出
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

/**
 * 从任务结果中提取图片 URL 列表
 * 支持同步和异步两种响应格式
 */
export function extractImageUrls(output) {
  const images = []

  // 异步任务结果格式：output.results[].url
  if (output.results && Array.isArray(output.results)) {
    for (const r of output.results) {
      if (r.url) images.push(r.url)
    }
  }

  // 同步或异步 choices 格式：output.choices[].message.content[].image
  if (output.choices) {
    for (const choice of output.choices) {
      if (choice.message && choice.message.content) {
        for (const item of choice.message.content) {
          if (item.image) images.push(item.image)
        }
      }
    }
  }

  return images
}