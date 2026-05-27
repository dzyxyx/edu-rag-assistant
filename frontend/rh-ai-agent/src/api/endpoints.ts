import apiClient from './clients'
import type {
  Company,
  CompanyFilters,
  CompaniesResponse,
  Competency,
  CompetencyGap,
  OutreachCard,
  FollowUp,
  Project,
  MemoryNode,
  Vacancy,
  PaginatedResponse,
  TaskStatus,
  DashboardStats,
  Notification,
  UserCreate, 
  UserRead, 
  UserLogin, 
  TokenResponse
} from './types'

export const companiesApi = {
  // Список компаний с фильтрацией
  list: (filters?: CompanyFilters) =>
    apiClient.get<CompaniesResponse>('/companies', { params: filters }),

  // Получить компанию по ID
  getById: (companyId: number) =>
    apiClient.get<Company>(`/companies/${companyId}`),

  // Создать компанию
  create: (data: Partial<Company>) =>
    apiClient.post<Company>('/companies', data),

  // Обновить компанию
  update: (companyId: number, data: Partial<Company>) =>
    apiClient.patch<Company>(`/companies/${companyId}`, data),

  // Удалить компанию
  delete: (companyId: number) =>
    apiClient.delete(`/companies/${companyId}`),

  // Скоринг компаний
  score: (companyIds: number[]) =>
    apiClient.post<{ task_id: string }>('/companies/score', { company_ids: companyIds }),

  // Верификация компаний
  verify: (companyIds: number[]) =>
    apiClient.post<{ task_id: string }>('/companies/verify', { company_ids: companyIds }),

  // Экспорт компаний
  export: (filters?: CompanyFilters) =>
    apiClient.get<Blob>('/companies/export', { 
      params: filters,
      responseType: 'blob',
    }),
}

export const competenciesApi = {
  list: () =>
    apiClient.get<Competency[]>('/competencies'),

  getGaps: () =>
    apiClient.get<CompetencyGap[]>('/competencies/gaps'),

  analyzeMarket: () =>
    apiClient.post<{ task_id: string }>('/competencies/analyze-market'),

  approveStrategy: (industry: string, skills: string[]) =>
    apiClient.post('/competencies/approve-strategy', { industry, skills }),
}

export const outreachApi = {
  list: () =>
    apiClient.get<OutreachCard[]>('/outreach'),

  getById: (id: number) =>
    apiClient.get<OutreachCard>(`/outreach/${id}`),

  create: (data: Partial<OutreachCard>) =>
    apiClient.post<OutreachCard>('/outreach', data),

  update: (id: number, data: Partial<OutreachCard>) =>
    apiClient.patch<OutreachCard>(`/outreach/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/outreach/${id}`),

  moveStatus: (id: number, status: OutreachCard['status']) =>
    apiClient.patch<OutreachCard>(`/outreach/${id}/status`, { status }),

  generateLetter: (id: number, tone: 'formal' | 'informal') =>
    apiClient.post<{ task_id: string; draft: string }>(`/outreach/${id}/generate`, { tone }),

  saveAgreement: (id: number, summary: string, text: string) =>
    apiClient.post(`/outreach/${id}/agreement`, { summary, text }),

  addFollowUp: (id: number, followUp: Omit<FollowUp, 'id'>) =>
    apiClient.post<FollowUp>(`/outreach/${id}/follow-ups`, followUp),

  sendFollowUp: (id: number, followUpId: number) =>
    apiClient.post<{ task_id: string }>(`/outreach/${id}/follow-ups/${followUpId}/send`),

  giveFeedback: (id: number, feedback: 'positive' | 'negative') =>
    apiClient.post(`/outreach/${id}/feedback`, { feedback }),
}

export const projectsApi = {
  list: () =>
    apiClient.get<Project[]>('/projects'),

  getById: (id: number) =>
    apiClient.get<Project>(`/projects/${id}`),

  create: (data: Partial<Project>) =>
    apiClient.post<Project>('/projects', data),

  update: (id: number, data: Partial<Project>) =>
    apiClient.patch<Project>(`/projects/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/projects/${id}`),

  publish: (id: number) =>
    apiClient.post<{ task_id: string }>(`/projects/${id}/publish`),

  export: () =>
    apiClient.get<Blob>('/projects/export', { responseType: 'blob' }),
}

export const memoryApi = {
  getGraph: () =>
    apiClient.get<MemoryNode[]>('/memory/graph'),

  addNode: (data: Partial<MemoryNode>) =>
    apiClient.post<MemoryNode>('/memory/nodes', data),

  addConnection: (fromId: number, toId: number, strength: number) =>
    apiClient.post('/memory/connections', { from_id: fromId, to_id: toId, strength }),

  updateWeights: () =>
    apiClient.post<{ task_id: string }>('/memory/update-weights'),

  clear: () =>
    apiClient.delete('/memory/clear'),
}

export const vacanciesApi = {
  list: (page = 1, limit = 50) =>
    apiClient.get<PaginatedResponse<Vacancy>>('/vacancies', { params: { page, limit } }),

  parse: (source: 'hh' | 'superjob' | 'linkedin') =>
    apiClient.post<{ task_id: string }>('/vacancies/parse', { source }),

  syncHH: () =>
    apiClient.post<{ task_id: string }>('/vacancies/sync-hh'),
}

export const dashboardApi = {
  stats: () =>
    apiClient.get<DashboardStats>('/dashboard/stats'),

  activities: (limit = 20) =>
    apiClient.get(`/dashboard/activities?limit=${limit}`),
}

export const notificationsApi = {
  list: () =>
    apiClient.get<Notification[]>('/notifications'),

  markAsRead: (id: number) =>
    apiClient.post(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post('/notifications/mark-all-read'),
}

export const tasksApi = {
  getStatus: (taskId: string) =>
    apiClient.get<TaskStatus>(`/tasks/${taskId}`),

  waitForCompletion: async (
    taskId: string,
    interval = 1500,
    maxAttempts = 40
  ): Promise<any> => {
    for (let i = 0; i < maxAttempts; i++) {
      const { data } = await tasksApi.getStatus(taskId)
      
      if (data.status === 'SUCCESS') {
        return data.result
      }
      
      if (data.status === 'FAILURE') {
        throw new Error(data.error || 'Task failed')
      }
      
      if (data.status === 'RETRY') {
        throw new Error('Task retry exceeded')
      }
      
      await new Promise(resolve => setTimeout(resolve, interval))
    }
    
    throw new Error('Task timeout: maximum attempts exceeded')
  },
}

export const chatApi = {
  sendMessage: (message: string, context?: any) =>
    apiClient.post('/chat/send', { message, context }),

  getHistory: (limit = 50) =>
    apiClient.get(`/chat/history?limit=${limit}`),

  clearHistory: () =>
    apiClient.delete('/chat/history'),
}

export const authApi = {
  // 🔥 Теперь возвращает UserRead (данные пользователя), а не токен
  register: (data: UserCreate) =>
    apiClient.post<UserRead>('/auth/register', data),

  // 🔥 Возвращает TokenResponse (access_token + refresh_token)
  login: (data: UserLogin) =>
    apiClient.post<TokenResponse>('/auth/login', data),

  me: () =>
    apiClient.get<UserRead>('/auth/me'),

  logout: () =>
    apiClient.post('/auth/logout'),
}