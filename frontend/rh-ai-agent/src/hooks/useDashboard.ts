import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/endpoints'

export function useDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.stats().then(res => res.data),
    refetchInterval: 60000,
  })

  return {
    stats: data,
    isLoading,
    error,
  }
}