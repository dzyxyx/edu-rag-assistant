import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, tasksApi } from '@/api/endpoints'
import { useAppStore } from '@/store/useAppStore'

export function useProjects() {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(res => res.data),
    placeholderData: [],
      
    select: (data) => {
      if (Array.isArray(data)) return data
      if (data && typeof data === 'object' && 'items' in data) {
        return (data as any).items
      }
      return []
    }
  })

  const publishMutation = useMutation({
    mutationFn: (id: number) => projectsApi.publish(id),
    onSuccess: async ({ data }) => {
      addToast('Запущена публикация проекта...', 'info')
      try {
        await tasksApi.waitForCompletion(data.task_id)
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        addToast('Проект успешно опубликован в LMS ПроКомпетенции', 'success')
      } catch (err) {
        addToast('Ошибка публикации', 'error')
      }
    },
    onError: () => {
      addToast('Не удалось опубликовать проект', 'error')
    },
  })

  const projects = Array.isArray(data) ? data : []

  return {
    projects,
    isLoading,
    publish: publishMutation.mutate,
    isPublishing: publishMutation.isPending,
  }
}