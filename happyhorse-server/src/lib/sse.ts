export interface SSEController {
  sendEvent(event: string, data: unknown): void
  close(): void
}

export function sseResponse(handler: (sse: SSEController) => Promise<void>): Response {
  return new Response(
    new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sse: SSEController = {
          sendEvent(event: string, data: unknown) {
            const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(payload))
          },
          close() {
            controller.close()
          },
        }

        try {
          await handler(sse)
        } catch (err) {
          sse.sendEvent('error', { error: err instanceof Error ? err.message : '未知错误' })
        } finally {
          sse.close()
        }
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    },
  )
}
