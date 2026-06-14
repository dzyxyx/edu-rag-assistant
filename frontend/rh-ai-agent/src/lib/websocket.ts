import type { ChatStreamChunk } from '@/api/types'

export interface WebSocketChatOptions {
  onMessage: (chunk: ChatStreamChunk) => void
  onError?: (error: Event) => void
  onClose?: () => void
  onOpen?: () => void
}

export class WebSocketChat {
  private ws: WebSocket | null = null
  private baseUrl: string
  private sessionId: number
  private token: string
  private options: WebSocketChatOptions
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor(
    baseUrl: string,
    sessionId: number,
    token: string,
    options: WebSocketChatOptions
  ) {
    this.baseUrl = baseUrl.replace(/^http/, 'ws')
    this.sessionId = sessionId
    this.token = token
    this.options = options
  }

  connect(): void {
    const url = `${this.baseUrl}/api/v1/rag/ws/chat/${this.sessionId}?token=${encodeURIComponent(this.token)}`
    
    console.log('Connecting to WebSocket:', url.replace(/token=[^&]+/, 'token=***'))
    
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      this.options.onOpen?.()
    }

    this.ws.onmessage = (event) => {
      try {
        const chunk: ChatStreamChunk = JSON.parse(event.data)
        
        if (chunk.done) {
          console.log('Stream completed')
        } else if (chunk.error) {
          console.error('Stream error:', chunk.error)
          this.options.onError?.(new Event(chunk.error))
          return
        }
        
        this.options.onMessage(chunk)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.options.onError?.(error)
    }

    this.ws.onclose = () => {
      console.log('WebSocket closed')
      this.options.onClose?.()
      
      // Авто-переподключение при ошибке
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts)
      }
    }
  }

  send(message: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ question: message }))
    } else {
      console.error('WebSocket is not connected')
    }
  }

  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export function createChatWebSocket(
  sessionId: number,
  token: string,
  options: WebSocketChatOptions
): WebSocketChat {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  return new WebSocketChat(baseUrl, sessionId, token, options)
}