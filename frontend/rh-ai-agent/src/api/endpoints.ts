import apiClient, { chatClient } from './clients'
import type {
  // Company
  Company,
  CompanyFilters,
  CompaniesResponse,
  CompanyStatusUpdate,
  CompanyScoreRequest,
  // Competency
  Competency,
  CompetencyGap,
  CompetencyItem,
  // Outreach
  OutreachCard,
  FollowUp,
  // Project
  Project,
  // Memory
  MemoryNode,
  MemoryConnection,
  // Vacancy
  Vacancy,
  PaginatedResponse,
  // Task
  TaskStatus,
  // Dashboard
  DashboardStats,
  ActivityLog,
  // Notifications
  Notification,
  // Chat (RAG)
  ChatMessage,
  ChatSession,
  ChatRequest,
  ChatResponse,
  SessionsListResponse,
  ChatStreamChunk,
  // Industry Analytics
  IndustryMatrixItem,
  PriorityArea,
  PriorityAreaReview,
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

  updateStatus: (companyId: number, data: CompanyStatusUpdate) =>
    apiClient.patch<Company>(`/companies/${companyId}/status`, data),

  requestScore: (data: CompanyScoreRequest) =>
    apiClient.post<{ task_id: string }>('/companies/score', data),

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

// ==================== TASKS ====================
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
export const chatApi = {
  sendMessage: (data: ChatRequest) =>
    chatClient.post<ChatResponse>('/rag/chat', {
      question: data.question,
      session_id: data.session_id,
    }),

  getSessions: () =>
    chatClient.get<SessionsListResponse>('/rag/sessions'),

  getMessages: (sessionId: number) =>
    chatClient.get<ChatMessage[]>(`/rag/sessions/${sessionId}/messages`),

  deleteSession: (sessionId: number) =>
    chatClient.delete(`/rag/sessions/${sessionId}`),

  updateSession: (sessionId: number, title: string) =>
    chatClient.patch<ChatSession>(`/rag/sessions/${sessionId}`, { title }),
}

// ==================== INDUSTRY ANALYTICS ====================
export const industryApi = {
  //  GET /industry/competencies - список компетенций
  getCompetencies: (params?: { 
    source?: 'industry' | 'program',
    category?: 'hard_skill' | 'tool' | 'soft_skill' | 'methodology',
    limit?: number 
  }) =>
    apiClient.get<PaginatedResponse<CompetencyItem>>('/industry/competencies', { params }),

  //  GET /industry/matrix - матрица компетенций по отраслям
  getMatrix: () =>
    apiClient.get<PaginatedResponse<IndustryMatrixItem>>('/industry/matrix'),

  //  POST /industry/analyze - запуск анализа
  analyze: (batchSize: number = 200) =>
    apiClient.post<{ 
      processed_vacancies: number
      competencies_found: number
      priority_area_industries: number
    }>(`/industry/analyze?batch_size=${batchSize}`),

  // GET /industry/priority-areas - список приоритетных областей
  getPriorityAreas: (status?: 'proposed' | 'approved' | 'rejected') =>
    apiClient.get<PaginatedResponse<PriorityArea>>('/industry/priority-areas', {
      params: status ? { status } : undefined,
    }),

  //  POST /industry/priority-areas/{area_id}/review - модерация
  reviewPriorityArea: (areaId: number, data: PriorityAreaReview) =>
    apiClient.post<PriorityArea>(`/industry/priority-areas/${areaId}/review`, data),
}

export const communicationsApi = {
  // Получить список типов коммуникаций
  getTypes: () =>
    apiClient.get<CommunicationsResponse>('/communications/types'),

  // Сгенерировать текст коммуникации
  generate: (data: CommunicationGenerateRequest) =>
    apiClient.post<CommunicationGenerateResponse>('/communications/generate', data),
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