import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi, tasksApi } from '@/api/endpoints'
import type { CompanyFilters } from '@/api/types'
import { useAppStore } from '@/store/useAppStore'

export function useCompanies(filters: CompanyFilters) {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => companiesApi.list(filters).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // 🔥 Не падаем, если бэкенд недоступен — возвращаем пустой массив
    placeholderData: { items: [], total: 0, page: 1, limit: 50, pages: 0 },
  })

  const verifyMutation = useMutation({
    mutationFn: (ids: number[]) => companiesApi.verify(ids),
    onSuccess: async ({ data }) => {
      addToast('Запущен процесс верификации...', 'info')
      try {
        await tasksApi.waitForCompletion(data.task_id)
        queryClient.invalidateQueries({ queryKey: ['companies'] })
        queryClient.invalidateQueries({ queryKey: ['outreach'] })
        addToast('Компании успешно добавлены в CRM', 'success')
      } catch (err) {
        addToast('Ошибка верификации', 'error')
      }
    },
    onError: (err) => {
      console.error('Verify error:', err)
      addToast('Не удалось запустить верификацию', 'error')
    },
  })

  return {
    companies: data?.items || [],
    total: data?.total || 0,
    isLoading,
    error,
    verifyCompanies: verifyMutation.mutate,
    isVerifying: verifyMutation.isPending,
  }
}