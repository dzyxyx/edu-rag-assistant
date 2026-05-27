import { useState, useCallback, useRef, useEffect } from 'react'
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
  
  // 🔥 Единое состояние для всех сообщений
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([])
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Получение истории чата из API
  const { isLoading: isLoadingHistory } = useQuery({
    queryKey: ['chat', 'history', sessionId],
    queryFn: async () => {
      if (!sessionId) return []
      try {
        const response = await chatApi.getMessages(sessionId)
        const data = response.data
        
        // 🔥 Нормализация: гарантируем массив
        const messages = Array.isArray(data) 
          ? data 
          : (data?.messages || data?.items || [])
        
        // 🔥 Нормализация полей: created_at → timestamp
        const normalized = messages.map((msg: any) => ({
          ...msg,
          timestamp: msg.timestamp || msg.created_at,
          id: msg.id || msg.message_id,
        }))
        
        // 🔥 Обновляем отображаемые сообщения ТОЛЬКО если они новее локальных
        setDisplayMessages(prev => {
          // Если в превью меньше сообщений — берём данные с сервера
          if (normalized.length > prev.length) {
            return normalized
          }
          return prev
        })
        
        return normalized
      } catch (error) {
        console.error('Error loading messages:', error)
        return []
      }
    },
    enabled: !!sessionId,
    staleTime: 30000, // 30 секунд — не запрашивать слишком часто
    retry: 1,
  })

  // Отправка сообщения
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const requestData: ChatRequest = {
        question: message,
        session_id: sessionId || undefined,
      }
      
      console.log('📤 Sending:', requestData)
      
      try {
        const response = await chatApi.sendMessage(requestData)
        console.log('📥 Response:', response.data)
        return response.data
      } catch (error: any) {
        console.error('❌ API error:', error)
        
        // 🔥 Заглушка если бэкенд недоступен
        if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000))
          return {
            answer: 'Это демо-режим. Подключите ИИ-модель для полноценной работы.',
            session_id: sessionId || 1,
            message_id: Date.now(),
            sources: [],
          } as ChatResponse
        }
        throw error
      }
    },
    
    // 🔥 СРАЗУ показываем сообщение пользователя
    onMutate: async (message) => {
      setIsTyping(true)
      setProgress(0)
      
      const userMessage: ChatMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        session_id: sessionId || undefined,
      }
      
      // 🔥 Добавляем в единый массив
      setDisplayMessages(prev => [...prev, userMessage])
      
      // Сохраняем предыдущее состояние для rollback при ошибке
      return { previousMessages: [...displayMessages] }
    },
    
    // 🔥 Показываем ответ ассистента
    onSuccess: (data: ChatResponse) => {
      console.log('✅ Success:', data)
      
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id)
      }
      
      const assistantMessage: ChatMessage = {
        id: data.message_id || `local-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        timestamp: new Date().toISOString(),
        session_id: data.session_id,
      }
      
      // 🔥 Добавляем ответ в тот же массив
      setDisplayMessages(prev => [...prev, assistantMessage])
      
      // 🔥 Обновляем кеш для будущих запросов
      queryClient.setQueryData(['chat', 'history', data.session_id], (old: any) => {
        const existing = Array.isArray(old) ? old : []
        // Не дублируем если сообщение уже есть
        if (!existing.find((m: any) => m.id === assistantMessage.id)) {
          return [...existing, assistantMessage]
        }
        return existing
      })
      
      setInput('')
      setProgress(100)
    },
    
    // 🔥 Откат при ошибке
    onError: (error: any, _vars, context: any) => {
      console.error('❌ Mutation error:', error)
      
      // Откат к предыдущему состоянию
      if (context?.previousMessages) {
        setDisplayMessages(context.previousMessages)
      }
      
      let message = 'Ошибка при отправке сообщения'
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        message = 'ИИ-агент думает слишком долго. Попробуйте позже.'
      } else if (error.response?.status === 422) {
        const detail = error.response.data?.detail
        message = Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : detail
      } else if (error.response?.data?.detail) {
        message = error.response.data.detail
      } else if (error.message) {
        message = error.message
      }
      addToast(message, 'error')
    },
    
    onSettled: () => {
      setIsTyping(false)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    },
  })

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  const newSession = useCallback(() => {
    setSessionId(null)
    setDisplayMessages([])
    setProgress(0)
    queryClient.invalidateQueries({ queryKey: ['chat', 'history'] })
  }, [queryClient])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isTyping) return
    await sendMessageMutation.mutateAsync(message)
  }, [sendMessageMutation, isTyping])

  return {
    // 🔥 Всегда возвращаем единый массив
    messages: displayMessages,
    input,
    setInput,
    sessionId,
    isTyping: isTyping || sendMessageMutation.isPending,
    isLoading: isLoadingHistory,
    progress,
    sendMessage,
    newSession,
  }
}