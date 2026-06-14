import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { outreachApi, tasksApi } from '@/api/endpoints'
import type { OutreachCard, FollowUp } from '@/api/types'
import { useAppStore } from '@/store/useAppStore'

export function useOutreach() {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['outreach'],
    queryFn: () => outreachApi.list().then(res => res.data),
    refetchInterval: 30000,
  })

  const moveStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: OutreachCard['status'] }) =>
      outreachApi.moveStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const generateLetterMutation = useMutation({
    mutationFn: ({ id, tone }: { id: number; tone: 'formal' | 'informal' }) =>
      outreachApi.generateLetter(id, tone),
    onSuccess: async ({ data }) => {
      addToast('Письмо сгенерировано', 'success')
      queryClient.invalidateQueries({ queryKey: ['outreach'] })
      return data.draft
    },
    onError: () => {
      addToast('Ошибка генерации письма', 'error')
    },
  })

  const saveAgreementMutation = useMutation({
    mutationFn: ({ id, summary, text }: { id: number; summary: string; text: string }) =>
      outreachApi.saveAgreement(id, summary, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      addToast('Соглашение сохранено, проект создан', 'success')
    },
    onError: () => {
      addToast('Ошибка сохранения соглашения', 'error')
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ id, feedback }: { id: number; feedback: 'positive' | 'negative' }) =>
      outreachApi.giveFeedback(id, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach'] })
      addToast('Обратная связь сохранена', 'success')
    },
  })

  const addFollowUpMutation = useMutation({
    mutationFn: ({ id, followUp }: { id: number; followUp: Omit<FollowUp, 'id'> }) =>
      outreachApi.addFollowUp(id, followUp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach'] })
      addToast('Фоллоу-ап добавлен', 'success')
    },
  })

  return {
    cards: data || [],
    isLoading,
    moveStatus: moveStatusMutation.mutate,
    generateLetter: generateLetterMutation.mutateAsync,
    saveAgreement: saveAgreementMutation.mutate,
    giveFeedback: feedbackMutation.mutate,
    addFollowUp: addFollowUpMutation.mutate,
    isGenerating: generateLetterMutation.isPending,
    isSaving: saveAgreementMutation.isPending,
  }
}