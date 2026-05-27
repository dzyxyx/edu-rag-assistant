// 🔥 Импортируем ВСЕ типы из types.ts (включая Chat)
import apiClient, { chatClient } from './clients'
import type {
  // Company
  Company,
  CompanyFilters,
  CompaniesResponse,
  // Competency
  Competency,
  CompetencyGap,
  // Outreach
  OutreachCard,
  FollowUp,
  // Project
  Project,
  // Memory
  MemoryNode,
  // Vacancy
  Vacancy,
  PaginatedResponse,
  // Task
  TaskStatus,
  // Dashboard
  DashboardStats,
  // Notifications
  Notification,
  // Chat (RAG)
  ChatMessage,
  ChatSession,
  ChatRequest,
  ChatResponse,
  SessionsListResponse,
  // User / Auth
  UserCreate,
  UserRead,
  UserLogin,
  TokenResponse,
} from './types'

// ==================== COMPANIES ====================
export const companiesApi = {
  list: (filters?: CompanyFilters) =>
    apiClient.get<CompaniesResponse>('/companies', { params: filters }),

  getById: (companyId: number) =>
    apiClient.get<Company>(`/companies/${companyId}`),

  create: (data: Partial<Company>) =>
    apiClient.post<Company>('/companies', data),

  update: (companyId: number, data: Partial<Company>) =>
    apiClient.patch<Company>(`/companies/${companyId}`, data),

  delete: (companyId: number) =>
    apiClient.delete(`/companies/${companyId}`),

  score: (companyIds: number[]) =>
    apiClient.post<{ task_id: string }>('/companies/score', { company_ids: companyIds }),

  verify: (companyIds: number[]) =>
    apiClient.post<{ task_id: string }>('/companies/verify', { company_ids: companyIds }),

  export: (filters?: CompanyFilters) =>
    apiClient.get<Blob>('/companies/export', { 
      params: filters,
      responseType: 'blob',
    }),
}

// ==================== COMPETENCIES ====================
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

// ==================== OUTREACH ====================
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

// ==================== PROJECTS ====================
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

// ==================== MEMORY ====================
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

// ==================== VACANCIES ====================
export const vacanciesApi = {
  list: (page = 1, limit = 50) =>
    apiClient.get<PaginatedResponse<Vacancy>>('/vacancies', { params: { page, limit } }),

  parse: (source: 'hh' | 'superjob' | 'linkedin') =>
    apiClient.post<{ task_id: string }>('/vacancies/parse', { source }),

  syncHH: () =>
    apiClient.post<{ task_id: string }>('/vacancies/sync-hh'),
}

// ==================== DASHBOARD ====================
export const dashboardApi = {
  stats: () =>
    apiClient.get<DashboardStats>('/dashboard/stats'),

  activities: (limit = 20) =>
    apiClient.get<ActivityLog[]>(`/dashboard/activities?limit=${limit}`),
}

// ==================== NOTIFICATIONS ====================
export const notificationsApi = {
  list: () =>
    apiClient.get<Notification[]>('/notifications'),

  markAsRead: (id: number) =>
    apiClient.post(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post('/notifications/mark-all-read'),
}

// ==================== TASKS (polling helper) ====================
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

// ==================== CHAT (RAG) ====================
// 🔥 Используем chatClient с увеличенным таймаутом
// 🔥 Типы импортированы из types.ts — никаких дубликатов!
export const chatApi = {
  // Отправить вопрос → получить ответ (или task_id, если асинхронно)
  sendMessage: (data: ChatRequest) =>
    chatClient.post<ChatResponse>('/rag/chat', {
      question: data.question,
      session_id: data.session_id,
    }),

  // Получить список сессий чата
  getSessions: () =>
    chatClient.get<ChatSession[]>('/rag/sessions'),

  // Получить сообщения конкретной сессии
  getMessages: (sessionId: number) =>
    chatClient.get<ChatMessage[]>(`/rag/sessions/${sessionId}/messages`),
}

// ==================== AUTH ====================
export const authApi = {
  register: (data: UserCreate) =>
    apiClient.post<UserRead>('/auth/register', data),

  login: (data: UserLogin) =>
    apiClient.post<TokenResponse>('/auth/login', data),

  me: () =>
    apiClient.get<UserRead>('/auth/me'),

  logout: () =>
    apiClient.post('/auth/logout'),
}