import apiClient, { chatClient } from './clients'
import type {
  // Company
  Company,
  CompanyFilters,
  CompaniesResponse,
  CompanyStatusUpdate,
  CompanyScoreRequest,
  CompanyCreate,
  CompanyImportRequest,
  CompanyImportResponse,
  IngestLogsResponse,
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

  create: (data: CompanyCreate) =>
    apiClient.post<Company>('/companies', data),

  update: (companyId: number, data: Partial<Company>) =>
    apiClient.patch<Company>(`/companies/${companyId}`, data),

  delete: (companyId: number) =>
    apiClient.delete(`/companies/${companyId}`),

  updateStatus: (companyId: number, data: CompanyStatusUpdate) =>
    apiClient.patch<Company>(`/companies/${companyId}/status`, data),

  rescoreCompany: (companyId: number) =>
    apiClient.post<Company>(`/companies/${companyId}/score`),

  getScoreHistory: (companyId: number, params?: { limit?: number; offset?: number }) =>
    apiClient.get<ScoreHistoryResponse>(`/companies/${companyId}/score-history`, { params }),

  verify: (companyIds: number[]) =>
    Promise.all(
      companyIds.map(id =>
        apiClient.patch<Company>(`/companies/${id}/status`, { status: 'verified' })
      )
    ),

  rescoreCompanies: (companyIds: number[]) =>
    Promise.all(
      companyIds.map(id =>
        apiClient.post<Company>(`/companies/${id}/score`)
      )
    ),

  export: (filters?: CompanyFilters) =>
    apiClient.get<Blob>('/companies/export', { 
      params: filters,
      responseType: 'blob',
    }),
  
  import: (data: CompanyImportRequest) =>
    apiClient.post<CompanyImportResponse>('/companies/import', data),

  getIngestLogs: (params?: { source?: string; limit?: number; offset?: number }) =>
    apiClient.get<IngestLogsResponse>('/companies/ingest-logs', { params }),
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
  list: (filters?: ProjectsFilters) =>
    apiClient.get<ProjectsResponse>('/projects', { params: filters }),

  create: (data: ProjectCreate) =>
    apiClient.post<Project>('/projects', data),

  getById: (projectId: number) =>
    apiClient.get<Project>(`/projects/${projectId}`),

  update: (projectId: number, data: ProjectUpdate) =>
    apiClient.patch<Project>(`/projects/${projectId}`, data),

  delete: (projectId: number) =>
    apiClient.delete(`/projects/${projectId}`),

  updateStatus: (projectId: number, data: ProjectStatusUpdate) =>
    apiClient.patch<Project>(`/projects/${projectId}/status`, data),

  generateSpec: (projectId: number, data: GenerateSpecRequest) =>
    apiClient.post<GenerateSpecResponse>(`/projects/${projectId}/generate-spec`, data),

  getRoles: (projectId: number) =>
    apiClient.get<RoleSlotsResponse>(`/projects/${projectId}/roles`),

  addRole: (projectId: number, data: RoleSlotCreate) =>
    apiClient.post<RoleSlot>(`/projects/${projectId}/roles`, data),

  assignRole: (projectId: number, slotId: number, data: RoleSlotAssign) =>
    apiClient.post<RoleSlot>(`/projects/${projectId}/roles/${slotId}/assign`, data),
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

  pendingReview: () =>
    apiClient.get<PendingReviewResponse>('/dashboard/pending-review'),

  activities: (limit = 20) =>
    apiClient.get<ActivityLog[]>(`/dashboard/activities?limit=${limit}`),
}

// ==================== NOTIFICATIONS ====================
export const notificationsApi = {
  list: (params?: { unread_only?: boolean; limit?: number; offset?: number }) =>
    apiClient.get<NotificationsResponse>('/notifications', { params }),

  markAsRead: (id: number) =>
    apiClient.post<{ status: string; notification: Notification }>(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.post<{ status: string; notification: null }>('/notifications/read-all'),
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
  getCompetencies: (params?: { 
    source?: 'industry' | 'program',
    category?: 'hard_skill' | 'tool' | 'soft_skill' | 'methodology',
    limit?: number 
  }) =>
    apiClient.get<PaginatedResponse<CompetencyItem>>('/industry/competencies', { params }),

  getMatrix: () =>
    apiClient.get<PaginatedResponse<IndustryMatrixItem>>('/industry/matrix'),

  analyze: (batchSize: number = 200) =>
    apiClient.post<{ 
      processed_vacancies: number
      competencies_found: number
      priority_area_industries: number
    }>(`/industry/analyze?batch_size=${batchSize}`),

  getPriorityAreas: (status?: 'proposed' | 'approved' | 'rejected') =>
    apiClient.get<PaginatedResponse<PriorityArea>>('/industry/priority-areas', {
      params: status ? { status } : undefined,
    }),

  reviewPriorityArea: (areaId: number, data: PriorityAreaReview) =>
    apiClient.post<PriorityArea>(`/industry/priority-areas/${areaId}/review`, data),
}

export const communicationsApi = {
  getTypes: () =>
    apiClient.get<CommunicationsResponse>('/communications/types'),

  generate: (data: CommunicationGenerateRequest) =>
    apiClient.post<CommunicationGenerateResponse>('/communications/generate', {
      ...data,
      ...(data.type === 'project_invitation' && data.project_id
        ? { project_id: data.project_id, project_name: undefined, project_description: undefined }
        : {}),
    }),
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