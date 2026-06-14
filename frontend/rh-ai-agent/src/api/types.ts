// ==================== БАЗОВЫЕ ТИПЫ ====================
export interface BaseEntity {
  id: number
  created_at: string
  updated_at: string
}

// ==================== COMPANY ====================
export interface Company {
  id: number
  name: string
  inn: string
  website: string
  description: string
  industry: string
  region: string
  employee_count: number
  email: string
  score: number
  score_tech_stack: number
  score_scale: number
  score_reputation: number
  score_edu_experience: number
  score_vacancy_activity: number | null
  status: string
  source: string
  created_at: string
  updated_at?: string
}

export interface CompanyFilters {
  status?: string | null
  limit?: number
  offset?: number
  search?: string
  industry?: string
  region?: string
}

export interface CompaniesResponse {
  total: number
  items: Company[]
}

export interface CompanyStatusUpdate {
  status: 'new' | 'verified' | 'in_progress' | 'rejected' | 'archived'
}

export interface CompanyScoreRequest {
  company_ids: number[]
}

export interface ScoreHistory {
  id: number
  score: number
  score_tech_stack: number
  score_scale: number
  score_reputation: number
  score_edu_experience: number
  score_vacancy_activity: number | null
  priority_bonus: number
  trigger: 'manual' | 'scheduled'
  created_at: string
}

export interface ScoreHistoryResponse {
  total: number
  items: ScoreHistory[]
}

// ==================== COMPETENCY ====================
export interface Competency extends BaseEntity {
  name: string
  category: string
  description?: string
  level: number
  is_required: boolean
}

export interface CompetencyGap {
  competency: string
  market_demand: number
  program_coverage: number
  gap: number
  trend: 'growing' | 'stable' | 'declining'
}

//  Компетенция из /industry/competencies
export interface CompetencyItem {
  id: number
  name: string
  category: string
  source: 'industry' | 'program'
  frequency: number
  demand_score: number
}

// ==================== OUTREACH ====================
export interface OutreachCard extends BaseEntity {
  company_id: number
  company_name: string
  status: 'draft' | 'sent' | 'interest' | 'rejected' | 'meeting' | 'waiting'
  contact_person?: string
  contact_email?: string
  last_message?: string
  letter_draft?: string
  letter_tone?: 'formal' | 'informal'
  follow_ups: FollowUp[]
  meeting_summary?: string
  agreement_text?: string
  agreement_signed: boolean
  feedback?: 'positive' | 'negative'
}

export interface FollowUp {
  id?: number
  day: number
  task: string
  status: 'pending' | 'sent' | 'done'
  scheduled_date?: string
}

// ==================== PROJECT ====================
export interface Project extends BaseEntity {
  title: string
  description: string
  technical_spec?: string
  partner_company_id?: number
  status: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
  duration_weeks?: number
  team_size?: number
  difficulty: 'easy' | 'medium' | 'hard'
  procompetency_id?: string
  created_at: string
}

export interface ProjectCreate {
  title: string
  description?: string
  partner_company_id?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  generate_spec?: boolean
  priority_area?: string
}

export interface ProjectUpdate {
  title?: string
  description?: string
  technical_spec?: string
  partner_company_id?: number
  status?: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
  duration_weeks?: number
  team_size?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  procompetency_id?: string
}

export interface ProjectStatusUpdate {
  status: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
}

export interface GenerateSpecRequest {
  priority_area?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  apply_role_slots?: boolean
}

export interface GenerateSpecResponse {
  project: Project
  role_slots_created: number
}

// ==================== AGENT MEMORY ====================
export interface MemoryNode extends BaseEntity {
  label: string
  type: 'company' | 'skill' | 'competency' | 'project'
  weight: number
  connections: MemoryConnection[]
  metadata?: Record<string, any>
}

export interface MemoryConnection {
  from_id: number
  to_id: number
  strength: number
  created_at: string
}

// ==================== VACANCY ====================
export interface Vacancy extends BaseEntity {
  title: string
  company: string
  source: 'hh' | 'superjob' | 'linkedin'
  required_skills: string[]
  experience_level: string
  salary_min?: number
  salary_max?: number
  posted_date: string
  url: string
}

// ==================== CHAT (RAG) ====================
export interface ChatMessage {
  id?: number
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  created_at?: string
  session_id?: number
  sources?: Array<{
    title: string
    url?: string
    snippet?: string
  }>
  market_context?: boolean
}

export interface ChatSession {
  id: number
  title?: string
  created_at: string
  updated_at?: string
  user_id?: number
  is_active: boolean
  message_count?: number
  last_message?: string
}

export interface ChatRequest {
  question: string
  session_id?: number
}

export interface ChatResponse {
  answer: string
  session_id: number
  message_id: number
  sources?: Array<{
    title: string
    url?: string
    snippet?: string
  }>
  market_context?: boolean
}

export interface SessionsListResponse {
  sessions: ChatSession[]
  total?: number
}

export interface ChatStreamChunk {
  content?: string
  done?: boolean
  error?: string
  session_id?: number
  message_id?: number
  sources?: Array<{
    title: string
    url?: string
    snippet?: string
  }>
  market_context?: boolean
}

// ==================== TASKS ====================
export interface TaskStatus {
  task_id: string
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY'
  result?: any
  error?: string
  progress?: number
}

// ==================== USER / AUTH ====================
export interface User extends BaseEntity {
  email: string
  full_name: string
  organization: string
  role: 'admin' | 'manager' | 'student'
  is_active: boolean
  locale: 'ru' | 'en'
}

export interface UserCreate {
  email: string
  full_name: string
  password: string
}

export interface UserLogin {
  email: string
  password: string
}

export interface UserRead {
  id: number
  email: string
  full_name: string
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type?: string 
}

// ==================== PAGINATED RESPONSE ====================
export interface PaginatedResponse<T> {
  total: number
  items: T[]
  page?: number
  limit?: number
  pages?: number
}

// ==================== DASHBOARD ====================
export interface DashboardStats {
  companies_total: number
  companies_shortlisted: number
  companies_partners: number
  priority_areas_proposed: number
  priority_areas_approved: number
  outreach_sent: number
  outreach_replied: number
  outreach_escalated: number
  pending_review_total: number
}

export interface PendingReviewItem {
  type: 'priority_area' | 'outreach_event'
  id: number
  title: string
  description: string
  status: string
  created_at: string
  link: string
}

export interface PendingReviewResponse {
  total: number
  items: PendingReviewItem[]
}

export interface ActivityLog {
  id: number
  action: string
  details: string
  timestamp: string
  type: 'info' | 'success' | 'warning' | 'error'
}

// ==================== NOTIFICATIONS ====================
export interface Notification {
  id: number
  type: 'priority_area_proposed' | 'outreach_escalated' | 'outreach_draft_review' | 'general'
  title: string
  message: string
  entity_type: string
  entity_id: number
  recipient_role: string
  is_read: boolean
  created_at: string
}

export interface NotificationsResponse {
  items: Notification[]
  total: number
  unread: number
}

// ==================== INDUSTRY ANALYTICS ====================

//  Элемент матрицы (из /industry/matrix)
export interface IndustryMatrixItem {
  competency: string
  category: string
  industry: string
  mentions: number
}

//  Приоритетная область (из /industry/priority-areas)
export interface PriorityArea {
  id: number
  name: string
  description: string
  industry: string
  score: number
  competency_ids: number[]
  status: 'proposed' | 'approved' | 'rejected'
  reviewed_by?: string
  review_comment?: string
  created_at: string
}

export interface PriorityAreaReview {
  status: 'approved' | 'rejected'
  comment?: string
}

export interface CompetencyDemand {
  name: string
  category: string
  market_demand: number
  program_coverage: number
  gap: number
  trend: 'growing' | 'stable' | 'declining'
  priority_score?: number
}

// ==================== COMMUNICATIONS ====================

export interface CommunicationType {
  type: 'outreach' | 'follow_up' | 'rejection' | 'project_invitation' | 'notification'
  description: string
  requires_company: boolean
}

export interface CommunicationGenerateRequest {
  type: 'outreach' | 'follow_up' | 'rejection' | 'project_invitation' | 'notification'
  company_id?: number
  tone: 'formal' | 'informal'
  use_memory?: boolean
  
  // Дополнительные поля для разных типов
  previous_subject?: string  // follow_up
  follow_up_number?: number  // follow_up
  reason?: string            // rejection
  project_name?: string      // project_invitation
  project_description?: string // project_invitation
  recipient_role?: string    // notification
  message?: string           // notification
}

export interface CommunicationGenerateResponse {
  type: string
  company_id?: number
  tone: string
  subject: string
  body: string
  memory_used_count: number
}

export interface CommunicationsResponse {
  items: CommunicationType[]
}

export interface RoleSlot {
  id: number
  project_id: number
  role: 'developer' | 'analyst' | 'designer' | 'manager' | 'tester' | 'devops'
  slots_count: number
  skills_required: string[]  // Бэкенд возвращает JSON-строку, парсим на фронте
  assigned_student_id?: number
}

export interface RoleSlotCreate {
  role: 'developer' | 'analyst' | 'designer' | 'manager' | 'tester' | 'devops'
  slots_count?: number
  skills_required?: string[]
}

export interface RoleSlotAssign {
  student_id: number
}

export interface RoleSlotsResponse {
  items: RoleSlot[]
}

// ==================== PROJECTS LIST ====================
export interface ProjectsResponse {
  total: number
  items: Project[]
}

export interface ProjectsFilters {
  status?: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived'
  partner_company_id?: number
  limit?: number
  offset?: number
}

// ==================== COMPANY CREATE/IMPORT ====================

export interface CompanyCreate {
  name: string
  inn?: string
  website?: string
  description?: string
  industry?: string
  region?: string
  employee_count?: number
  email?: string
  phone?: string
  linkedin_url?: string
}

export interface CompanyImportItem {
  name: string
  inn?: string
  website?: string
  description?: string
  industry?: string
  region?: string
  employee_count?: number
  email?: string
  phone?: string
  linkedin_url?: string
}

export interface CompanyImportRequest {
  items: CompanyImportItem[]
}

export interface CompanyImportResponse {
  total: number
  created: number
  updated: number
  log_id: number
}

// ==================== INGEST LOGS ====================

export interface IngestLog {
  id: number
  source: string
  trigger: string
  status: 'running' | 'success' | 'failed'
  started_at: string
  finished_at?: string
  companies_created: number
  companies_updated: number
  vacancies_created: number
  vacancies_updated: number
  skipped_duplicates: number
  errors_count: number
  error_message?: string | null
}

export interface IngestLogsResponse {
  total: number
  items: IngestLog[]
}