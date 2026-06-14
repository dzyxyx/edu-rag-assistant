import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi, tasksApi } from '@/api/endpoints'
import type { CompanyFilters } from '@/api/types'
import { useAppStore } from '@/store/useAppStore'

export function useCompanies(filters: CompanyFilters = {}) {
  const queryClient = useQueryClient()
  const { addToast } = useAppStore()

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => companiesApi.list(filters).then(res => res.data),
    
    
    staleTime: 5 * 60 * 1000, // 5 минут кэш
    gcTime: 10 * 60 * 1000,   // 10 минут хранение в кэше
    refetchOnWindowFocus: false,
    retry: 1,
    
    // Нормализация ответа
    select: (apiData) => {
      if (!apiData) return { items: [], total: 0 }
      if (Array.isArray(apiData)) return { items: apiData, total: apiData.length }
      if (typeof apiData === 'object') {
        return {
          items: Array.isArray(apiData.items) ? apiData.items : (apiData.data || []),
          total: apiData.total || 0
        }
      }
      return { items: [], total: 0 }
    }
  })

  const verifyMutation = useMutation({
    mutationFn: (ids: number[]) => companiesApi.verify(ids),
    onSuccess: async ({ data }) => {
      addToast('Запущен процесс верификации...', 'info')
      try {
        await tasksApi.waitForCompletion(data.task_id)
        queryClient.invalidateQueries({ queryKey: ['companies'] })
        addToast('Компании успешно верифицированы', 'success')
      } catch {
        addToast('Ошибка верификации', 'error')
      }
    },
    onError: () => addToast('Не удалось запустить верификацию', 'error'),
  })

  const scoreMutation = useMutation({
    mutationFn: (ids: number[]) => companiesApi.score(ids),
    onSuccess: async ({ data }) => {
      addToast('Запущен процесс скоринга...', 'info')
      try {
        await tasksApi.waitForCompletion(data.task_id)
        queryClient.invalidateQueries({ queryKey: ['companies'] })
        addToast('Скоринг завершён', 'success')
      } catch {
        addToast('Ошибка скоринга', 'error')
      }
    },
    onError: () => addToast('Не удалось запустить скоринг', 'error'),
  })

  return {
    companies: data?.items || [],
    total: data?.total || 0,
    isLoading,        //  Первая загрузка
    isFetching,       //  Любая загрузка (включая пагинацию)
    error,
    refetch,
    verifyCompanies: verifyMutation.mutate,
    isVerifying: verifyMutation.isPending,
    scoreCompanies: scoreMutation.mutate,
    isScoring: scoreMutation.isPending,
  }
}