import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { memoryApi, tasksApi } from '@/api/endpoints'
import { useAppStore } from '@/store/useAppStore'

export function useMemory() {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data, isLoading } = useQuery({
    queryKey: ['memory'],
    queryFn: () => memoryApi.getGraph().then(res => res.data),
    refetchInterval: 10000,
    placeholderData: [],
    select: (data) => {
      if (Array.isArray(data)) return data
      if (data && typeof data === 'object') {
        if ('nodes' in data && Array.isArray(data.nodes)) return data.nodes
        if ('items' in data && Array.isArray(data.items)) return data.items
      }
      return []
    }
  })

  const updateWeightsMutation = useMutation({
    mutationFn: () => memoryApi.updateWeights(),
    onSuccess: async ({ data }) => {
      addToast('Обновление весов памяти...', 'info')
      try {
        await tasksApi.waitForCompletion(data.task_id)
        queryClient.invalidateQueries({ queryKey: ['memory'] })
        addToast('Память агента обновлена', 'success')
      } catch (err) {
        addToast('Ошибка обновления памяти', 'error')
      }
    },
  })

  //  Гарантируем, что nodes — всегда массив
  const nodes = Array.isArray(data) ? data : []

  return {
    nodes,
    isLoading,
    updateWeights: updateWeightsMutation.mutate,
    isUpdating: updateWeightsMutation.isPending,
  }
}