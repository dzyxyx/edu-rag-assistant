import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi, tasksApi } from '@/api/endpoints'
import type { CompanyFilters } from '@/api/types'
import { useAppStore } from '@/store/useAppStore'

export function useCompanies(filters: CompanyFilters) {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => companiesApi.list(filters).then(res => res.data),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
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
        addToast('Ошибка верификации компаний', 'error')
      }
    },
    onError: () => {
      addToast('Не удалось запустить верификацию', 'error')
    },
  })

  const scoreMutation = useMutation({
    mutationFn: (ids: number[]) => companiesApi.score(ids),
    onSuccess: async ({ data }) => {
      addToast('Запущен процесс скоринга...', 'info')
      try {
        await tasksApi.waitForCompletion(data.task_id)
        queryClient.invalidateQueries({ queryKey: ['companies'] })
        addToast('Скоринг завершён', 'success')
      } catch (err) {
        addToast('Ошибка скоринга', 'error')
      }
    },
  })

  return {
    companies: data?.items || [],
    total: data?.total || 0,
    page: data?.page || 1,
    isLoading,
    error,
    refetch,
    verifyCompanies: verifyMutation.mutate,
    isVerifying: verifyMutation.isPending,
    scoreCompanies: scoreMutation.mutate,
    isScoring: scoreMutation.isPending,
  }
}