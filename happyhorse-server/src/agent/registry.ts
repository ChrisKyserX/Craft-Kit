export interface AgentDefinition {
  type: string
  name: string
  systemPrompt: string
  tools: string[]
  defaultModel: string
}

const builtinAgents: Record<string, AgentDefinition> = {
  general: {
    type: 'general',
    name: '通用助手',
    systemPrompt: `你是一个通用 AI 助手。你可以使用工具来帮助用户完成任务。
在回答时，请先用文字说明你的思考过程，然后调用合适的工具。
如果用户的问题很简单，直接回答即可，不需要调用工具。`,
    tools: ['read_file', 'write_file', 'list_files', 'text_to_video', 'image_to_video', 'poll_video'],
    defaultModel: 'claude-sonnet-5',
  },
  video: {
    type: 'video',
    name: '视频生成专家',
    systemPrompt: `你是一个专业的视频生成助手。你擅长：
1. 分析用户的视频需求，帮助优化 prompt
2. 使用 text_to_video 工具生成文生视频
3. 使用 image_to_video 工具生成图生视频
4. 使用 poll_video 工具查询生成进度

在生成视频前，先和用户确认关键参数（尺寸、时长等）。
生成完成后，告知用户视频链接。`,
    tools: ['text_to_video', 'image_to_video', 'poll_video'],
    defaultModel: 'claude-sonnet-5',
  },
  coding: {
    type: 'coding',
    name: '编程助手',
    systemPrompt: `你是一个编程助手。你可以：
1. 使用 read_file 读取文件
2. 使用 write_file 写入文件
3. 使用 list_files 列出目录
4. 使用 run_shell 执行命令

在修改代码前，先读取相关文件了解上下文。
修改后，运行相关测试确保没有破坏现有功能。`,
    tools: ['read_file', 'write_file', 'list_files', 'run_shell'],
    defaultModel: 'claude-sonnet-5',
  },
}

export function getAgentDefinition(type: string): AgentDefinition {
  const def = builtinAgents[type]
  if (!def) {
    return builtinAgents.general
  }
  return def
}

export function listAgentTypes(): AgentDefinition[] {
  return Object.values(builtinAgents)
}
