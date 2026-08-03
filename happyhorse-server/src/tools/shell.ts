import { toolRegistry } from '../agent/tool-registry'
import type { ToolContext } from '../agent/tool-registry'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd()

toolRegistry.register({
  name: 'run_shell',
  description: 'Execute a shell command. For programming tasks only.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in ms, default 30000' },
    },
    required: ['command'],
  },
  async execute(args, ctx: ToolContext) {
    const callId = crypto.randomUUID()
    ctx.sendEvent({ id: callId, name: 'run_shell', status: 'running', message: `Executing: ${args.command}` })

    try {
      const { stdout, stderr } = await execAsync(args.command as string, {
        cwd: WORKSPACE_ROOT,
        timeout: (args.timeout as number) || 30000,
        maxBuffer: 1024 * 1024,
      })

      const result = {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
      }
      ctx.sendEvent({ id: callId, name: 'run_shell', status: 'completed', result })
      return result
    } catch (err: any) {
      const result = {
        stdout: err.stdout?.trim() || '',
        stderr: err.stderr?.trim() || '',
        exitCode: err.code || 1,
        error: err.message,
      }
      ctx.sendEvent({ id: callId, name: 'run_shell', status: 'completed', result })
      return result
    }
  },
})