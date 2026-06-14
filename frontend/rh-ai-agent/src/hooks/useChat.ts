import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/endpoints'
import type { ChatMessage, ChatRequest, ChatResponse } from '@/api/types'
import { useAppStore } from '@/store/useAppStore'

export function useChat() {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [progress, setProgress] = useState(0)
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([])

  const { isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chat', 'history', sessionId],
    queryFn: async () => {
      if (!sessionId) return []
      try {
        const res = await chatApi.getMessages(sessionId)
        const data = res.data
        const items = Array.isArray(data) ? data : (data?.messages || data?.items || [])
        return items.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp || msg.created_at,
          id: msg.id || msg.message_id,
        }))
      } catch { return [] }
    },
    enabled: !!sessionId,
    staleTime: 30000,
    retry: 1,
    onSuccess: (data) => {
      setDisplayMessages(Array.isArray(data) ? data : [])
    }
  })

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await chatApi.sendMessage({ question: message, session_id: sessionId || undefined })
      return res.data
    },
    onMutate: (message) => {
      setIsTyping(true)
      setProgress(0)
      const userMsg: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: message, timestamp: new Date().toISOString() }
      setDisplayMessages(prev => [...prev, userMsg])
      return { previousMessages: [...displayMessages] }
    },
    onSuccess: (data) => {
      if (data.session_id && !sessionId) setSessionId(data.session_id)
      
      const aiMsg: ChatMessage = { 
        id: data.message_id || `ai-${Date.now()}`, 
        role: 'assistant', 
        content: data.answer, 
        timestamp: new Date().toISOString(), 
        session_id: data.session_id 
      }
      setDisplayMessages(prev => [...prev, aiMsg])
      
      queryClient.setQueryData(['chat', 'history', data.session_id], (old: any) => {
        const existing = Array.isArray(old) ? old : []
        if (!existing.find((m: any) => m.id === aiMsg.id)) return [...existing, aiMsg]
        return existing
      })
      
      setInput('')
      setProgress(100)
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previousMessages) setDisplayMessages(ctx.previousMessages)
      addToast('Ошибка отправки сообщения', 'error')
    },
    onSettled: () => { setIsTyping(false) }
  })

  const selectSession = useCallback((id: number) => {
    setSessionId(id)
  }, [])

  const startNewChat = useCallback(() => {
    setSessionId(null)
    setDisplayMessages([])
    setInput('')
    queryClient.removeQueries({ queryKey: ['chat', 'history'] })
  }, [queryClient])

  return {
    messages: displayMessages,
    sessionId,
    input, 
    setInput,
    isTyping: isTyping || sendMessageMutation.isPending,
    isLoading: isLoadingHistory,
    sendMessage: (msg: string) => sendMessageMutation.mutateAsync(msg),
    selectSession,
    startNewChat,
  }
}