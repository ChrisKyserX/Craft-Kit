import type { Tool } from 'ai'

interface ToolDef {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

export interface ToolContext {
  sessionId: string
  sendEvent: (event: ToolEvent) => void
}

export interface ToolEvent {
  id: string
  name: string
  status: 'pending' | 'running' | 'polling' | 'completed' | 'failed'
  message?: string
  result?: unknown
  error?: string
}

class ToolRegistry {
  private tools: Map<string, ToolDef> = new Map()

  register(def: ToolDef) {
    this.tools.set(def.name, def)
  }

  get(name: string): ToolDef | undefined {
    return this.tools.get(name)
  }

  list(): string[] {
    return Array.from(this.tools.keys())
  }

  toVercelTools(): Record<string, Tool> {
    const result: Record<string, Tool> = {}
    for (const [name, def] of this.tools.entries()) {
      result[name] = {
        description: def.description,
        parameters: def.parameters as any,
        execute: def.execute as any,
      }
    }
    return result
  }
}

export const toolRegistry = new ToolRegistry()
