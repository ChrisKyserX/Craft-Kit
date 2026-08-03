import { toolRegistry } from '../agent/tool-registry'
import type { ToolContext } from '../agent/tool-registry'

function dashscopeClient(apiKey: string) {
  const baseUrl = 'https://dashscope.aliyuncs.com/api/v1'
  return {
    async createTask(model: string, input: Record<string, unknown>, parameters: Record<string, unknown> = {}) {
      const res = await fetch(`${baseUrl}/services/aigc/video-generation/video-synthesis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({ model, input, parameters }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || `DashScope API error: ${res.status}`)
      }
      const data = await res.json()
      return data.output
    },
    async queryTask(taskId: string) {
      const res = await fetch(`${baseUrl}/tasks/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      if (!res.ok) throw new Error(`Query task error: ${res.status}`)
      const data = await res.json()
      return data.output
    },
  }
}

toolRegistry.register({
  name: 'text_to_video',
  description: '使用文本描述生成视频。提交后返回任务ID，需要配合 poll_video 查询进度。',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '视频描述文本' },
      size: { type: 'string', enum: ['1280*720', '720*1280', '960*960'], description: '视频尺寸' },
      duration: { type: 'number', enum: [3, 5, 7, 10], description: '视频时长(秒)' },
    },
    required: ['prompt'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'running' })

    const apiKey = (ctx as any).apiKey || process.env.DASHSCOPE_API_KEY
    const client = dashscopeClient(apiKey)

    const params: Record<string, unknown> = {}
    if (args.size) params.size = args.size
    if (args.duration) params.duration = args.duration

    const output = await client.createTask('happyhorse-1.0-t2v', { prompt: args.prompt }, params)
    const taskId = output.task_id

    ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'polling', message: '任务已提交，等待生成...' })

    const terminalStates = ['SUCCEEDED', 'FAILED']
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000))
      const status = await client.queryTask(taskId)

      if (terminalStates.includes(status.task_status)) {
        if (status.task_status === 'SUCCEEDED') {
          const videoUrl = status.video_url || (status.results?.[0]?.url) || ''
          ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'completed', result: { videoUrl, taskId } })
          return { videoUrl, taskId }
        } else {
          const error = status.message || '视频生成失败'
          ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'failed', error })
          return { error, taskId }
        }
      }

      ctx.sendEvent({ id: callId, name: 'text_to_video', status: 'polling', message: '生成中...', result: { taskId, taskStatus: status.task_status } })
    }
  },
})

toolRegistry.register({
  name: 'image_to_video',
  description: '使用图片生成视频。需要提供图片 URL。提交后返回任务ID，需要配合 poll_video 查询进度。',
  parameters: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string', description: '首帧图片 URL' },
      prompt: { type: 'string', description: '视频运动描述（可选）' },
      size: { type: 'string', enum: ['1280*720', '720*1280', '960*960'], description: '视频尺寸' },
      duration: { type: 'number', enum: [3, 5, 7, 10], description: '视频时长(秒)' },
    },
    required: ['imageUrl'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'running' })

    const apiKey = (ctx as any).apiKey || process.env.DASHSCOPE_API_KEY
    const client = dashscopeClient(apiKey)

    const input: Record<string, unknown> = {
      prompt: args.prompt || '',
      media: [{ type: 'first_frame', url: args.imageUrl }],
    }
    const params: Record<string, unknown> = {}
    if (args.size) params.size = args.size
    if (args.duration) params.duration = args.duration

    const output = await client.createTask('happyhorse-1.0-i2v', input, params)
    const taskId = output.task_id

    ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'polling', message: '任务已提交，等待生成...' })

    const terminalStates = ['SUCCEEDED', 'FAILED']
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 5000))
      const status = await client.queryTask(taskId)

      if (terminalStates.includes(status.task_status)) {
        if (status.task_status === 'SUCCEEDED') {
          const videoUrl = status.video_url || (status.results?.[0]?.url) || ''
          ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'completed', result: { videoUrl, taskId } })
          return { videoUrl, taskId }
        } else {
          const error = status.message || '视频生成失败'
          ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'failed', error })
          return { error, taskId }
        }
      }

      ctx.sendEvent({ id: callId, name: 'image_to_video', status: 'polling', message: '生成中...', result: { taskId, taskStatus: status.task_status } })
    }
  },
})

toolRegistry.register({
  name: 'poll_video',
  description: '查询视频生成任务的状态',
  parameters: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: '视频任务 ID' },
    },
    required: ['taskId'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'poll_video', status: 'running' })

    const apiKey = (ctx as any).apiKey || process.env.DASHSCOPE_API_KEY
    const client = dashscopeClient(apiKey)
    const status = await client.queryTask(args.taskId as string)

    ctx.sendEvent({ id: callId, name: 'poll_video', status: 'completed', result: status })
    return status
  },
})
