// Базовые типы
export interface BaseEntity {
  id: number
  created_at: string
  updated_at: string
}

// Company
export interface Company {
  id: number
  name: string
  inn?: string
  website?: string
  description?: string
  industry?: string
  region?: string
  employee_count?: number
  email?: string
  score: number
  score_tech_stack?: number
  score_scale?: number
  score_reputation?: number
  score_edu_experience?: number
  status: string
  source?: string
  created_at: string
}

export interface CompanyFilters {
  status?: string | null
  limit?: number
  offset?: number
  search?: string
  industry?: string
  region?: string
  min_score?: number
}

// Competency
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

// Outreach (CRM)
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

// Project
export interface Project extends BaseEntity {
  title: string
  partner: string
  company_id: number
  complexity: 'easy' | 'medium' | 'hard'
  roles: string[]
  competencies: string[]
  technologies: string[]
  status: 'product' | 'research' | 'educational'
  is_published: boolean
  tz_content?: string
  deadline?: string
  max_students?: number
}

// Agent Memory
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

// Vacancy
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

// Chat
export interface ChatMessage extends BaseEntity {
  user_id: number
  content: string
  role: 'user' | 'assistant' | 'system'
  is_read: boolean
}

export interface ChatSession extends BaseEntity {
  user_id: number
  title: string
  is_active: boolean
}

// User
export interface User extends BaseEntity {
  email: string
  full_name: string
  organization: string
  role: 'admin' | 'manager' | 'student'
  is_active: boolean
  locale: 'ru' | 'en'
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

// Task status (Celery)
export interface TaskStatus {
  task_id: string
  status: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE' | 'RETRY'
  result?: any
  error?: string
  progress?: number
}

// Dashboard stats
export interface DashboardStats {
  total_companies: number
  total_projects: number
  total_outreach: number
  conversion_rate: number
  meetings_count: number
  conversion_chart: { month: string; value: number }[]
  recent_activities: ActivityLog[]
}

export interface ActivityLog {
  id: number
  action: string
  details: string
  timestamp: string
  type: 'info' | 'success' | 'warning' | 'error'
}

// Notifications
export interface Notification extends BaseEntity {
  user_id: number
  type: 'escalation' | 'followup' | 'response' | 'system'
  title: string
  message: string
  is_read: boolean
  link?: string
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