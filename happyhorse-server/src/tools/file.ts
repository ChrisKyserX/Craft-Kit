import { toolRegistry } from '../agent/tool-registry'
import type { ToolContext } from '../agent/tool-registry'
import fs from 'fs/promises'
import path from 'path'

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd()

function resolvePath(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath)
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error('不允许访问工作区外的路径')
  }
  return resolved
}

toolRegistry.register({
  name: 'read_file',
  description: '读取文件内容',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对于工作区根目录）' },
    },
    required: ['path'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'read_file', status: 'running', message: `读取 ${args.path}` })

    try {
      const filePath = resolvePath(args.path as string)
      const content = await fs.readFile(filePath, 'utf-8')
      ctx.sendEvent({ id: callId, name: 'read_file', status: 'completed', result: { path: args.path, content } })
      return { path: args.path, content }
    } catch (err) {
      const error = err instanceof Error ? err.message : '读取失败'
      ctx.sendEvent({ id: callId, name: 'read_file', status: 'failed', error })
      return { error }
    }
  },
})

toolRegistry.register({
  name: 'write_file',
  description: '写入文件内容（会覆盖已有文件）',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径（相对于工作区根目录）' },
      content: { type: 'string', description: '文件内容' },
    },
    required: ['path', 'content'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'write_file', status: 'running', message: `写入 ${args.path}` })

    try {
      const filePath = resolvePath(args.path as string)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, args.content as string, 'utf-8')
      ctx.sendEvent({ id: callId, name: 'write_file', status: 'completed', result: { path: args.path } })
      return { path: args.path, success: true }
    } catch (err) {
      const error = err instanceof Error ? err.message : '写入失败'
      ctx.sendEvent({ id: callId, name: 'write_file', status: 'failed', error })
      return { error }
    }
  },
})

toolRegistry.register({
  name: 'list_files',
  description: '列出目录中的文件和文件夹',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: '目录路径（相对于工作区根目录，默认为根目录）' },
    },
    required: [],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    const dirPath = args.path ? resolvePath(args.path as string) : WORKSPACE_ROOT
    ctx.sendEvent({ id: callId, name: 'list_files', status: 'running', message: `列出 ${args.path || '/'}` })

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const result = entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }))
      ctx.sendEvent({ id: callId, name: 'list_files', status: 'completed', result })
      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : '列出失败'
      ctx.sendEvent({ id: callId, name: 'list_files', status: 'failed', error })
      return { error }
    }
  },
})
