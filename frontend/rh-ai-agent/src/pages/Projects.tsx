import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, companiesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { 
  Lock, FileText, CheckCircle, Loader2, Plus, Sparkles, AlertCircle 
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/store/useAppStore'
import type { Project, ProjectsFilters } from '@/api/types'

const getLevelLabel = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return 'Начальный'
    case 'hard': return 'Продвинутый'
    default: return 'Средний'
  }
}

const getLevelBadgeVariant = (difficulty: string) => {
  switch (difficulty) {
    case 'easy': return 'success'
    case 'hard': return 'warning'
    default: return 'secondary'
  }
}

export default function Projects() {
  const { i18n } = useTranslation()
  const { addToast } = useAppStore()
  const queryClient = useQueryClient()

  // === STATE ===
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isTZModalOpen, setIsTZModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isGeneratingTZ, setIsGeneratingTZ] = useState(false)
  const [tzGenerationTaskId, setTzGenerationTaskId] = useState<string | null>(null)

  // === FORM STATE ===
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    partner_company_id: undefined as number | undefined,
    priority_area: '',
    generateSpec: false
  })

  // === QUERIES ===
  const filters: ProjectsFilters = { limit: 100, offset: 0 }
  
  const { data: projectsData, isLoading: isLoadingProjects, refetch: refetchProjects } = useQuery({
    queryKey: ['projects', filters],
    queryFn: () => projectsApi.list(filters).then(res => res.data),
    staleTime: 2 * 60 * 1000,
  })

  const { data: companies } = useQuery({
    queryKey: ['companies', 'list'],
    queryFn: () => companiesApi.list({ limit: 200 }).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  })

  // 🔥 Детали проекта с увеличенным timeout
  const { data: projectDetail, isLoading: isLoadingDetail, refetch: refetchDetail } = useQuery({
    queryKey: ['project', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject) return null
      // Используем прямой запрос с большим таймаутом
      const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${selectedProject.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Accept': 'application/json',
        }
      })
      if (!response.ok) throw new Error('Failed to fetch project')
      return response.json()
    },
    enabled: !!selectedProject && isTZModalOpen,
    staleTime: 0,
    retry: 2,
  })

  // === POLLING для проверки готовности ТЗ ===
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (tzGenerationTaskId && isTZModalOpen && selectedProject) {
      console.log('🔄 Starting polling for task:', tzGenerationTaskId)
      
      interval = setInterval(async () => {
        try {
          // Проверяем статус проекта — если technical_spec появился, генерация завершена
          const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${selectedProject.id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
              'Accept': 'application/json',
            }
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('📊 Polling check:', { 
              hasSpec: !!data.technical_spec,
              specLength: data.technical_spec?.length 
            })
            
            if (data.technical_spec) {
              console.log('✅ TZ generated! Stopping polling.')
              clearInterval(interval!)
              setTzGenerationTaskId(null)
              setIsGeneratingTZ(false)
              await refetchDetail()
              await queryClient.invalidateQueries({ queryKey: ['projects', filters] })
              addToast('ТЗ успешно сгенерировано!', 'success')
            }
          }
        } catch (error) {
          console.error('❌ Polling error:', error)
        }
      }, 3000) // Проверяем каждые 3 секунды
    }
    
    return () => {
      if (interval) {
        console.log('🛑 Stopping polling')
        clearInterval(interval)
      }
    }
  }, [tzGenerationTaskId, isTZModalOpen, selectedProject?.id])

  const projects = projectsData?.items || []
  const companiesList = companies?.items || []

  const getCompanyName = (id?: number) => {
    if (!id) return 'Не указано'
    return companiesList.find(c => c.id === id)?.name || 'Компания'
  }

  // === MUTATIONS ===
  const createMutation = useMutation({
    mutationFn: async () => {
      console.log('📤 Creating project...')
      return projectsApi.create({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        difficulty: formData.difficulty,
        partner_company_id: formData.partner_company_id,
        generate_spec: formData.generateSpec,
        priority_area: formData.priority_area.trim() || undefined
      })
    },
    onSuccess: async (data) => {
      console.log('✅ Project created:', data)
      await queryClient.invalidateQueries({ queryKey: ['projects', filters] })
      await refetchProjects()
      setIsCreateModalOpen(false)
      resetForm()
      addToast('Проект успешно создан', 'success')
    },
    onError: (error: any) => {
      console.error('❌ Create error:', error)
      const message = error.response?.data?.detail || error.message || 'Ошибка при создании проекта'
      addToast(message, 'error')
    }
  })

  const publishMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log('📤 Publishing project:', id)
      const result = await projectsApi.updateStatus(id, { status: 'published' })
      console.log('✅ Publish response:', result)
      return result
    },
    onSuccess: async (data, variables) => {
      console.log('✅ Project published, invalidating...')
      // 🔥 Немедленно обновляем локально для мгновенного UI
      queryClient.setQueryData(['projects', filters], (old: any) => {
        if (!old) return old
        return {
          ...old,
          items: old.items.map((p: Project) => 
            p.id === variables ? { ...p, status: 'published' } : p
          )
        }
      })
      // Затем обновляем с сервера
      await queryClient.invalidateQueries({ queryKey: ['projects', filters] })
      await refetchProjects()
      addToast('Проект опубликован', 'success')
    },
    onError: (error: any) => {
      console.error('❌ Publish error:', error)
      addToast('Ошибка при публикации', 'error')
    }
  })

  const generateTZMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error('Проект не выбран')
      
      console.log('📤 Starting TZ generation for project:', selectedProject.id)
      
      const requestData = {
        apply_role_slots: true,
        difficulty: selectedProject.difficulty,
        priority_area: formData.priority_area.trim() || undefined
      }
      
      console.log('Request data:', requestData)
      
      // 🔥 Используем прямой fetch с большим таймаутом
      const response = await fetch(`${import.meta.env.VITE_API_URL}/projects/${selectedProject.id}/generate-spec`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestData),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      console.log('📥 Generation response:', data)
      return data
    },
    onSuccess: async () => {
      console.log('✅ TZ generation started, waiting for completion...')
      // 🔥 Запускаем polling вместо ожидания ответа
      setTzGenerationTaskId(`task-${Date.now()}`)
      // Не показываем success сразу — ждём polling
    },
    onError: (error: any) => {
      console.error('❌ Generate TZ error:', error)
      setIsGeneratingTZ(false)
      setTzGenerationTaskId(null)
      const message = error.message || 'Ошибка генерации ТЗ'
      addToast(message, 'error')
    },
    onMutate: () => {
      console.log('🔄 Starting TZ generation...')
      setIsGeneratingTZ(true)
    }
  })

  // === HANDLERS ===
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      difficulty: 'medium',
      partner_company_id: undefined,
      priority_area: '',
      generateSpec: false
    })
  }

  const openCreateModal = () => {
    resetForm()
    setIsCreateModalOpen(true)
  }

  const handleCreate = () => {
    if (!formData.title.trim()) {
      addToast('Введите название проекта', 'error')
      return
    }
    createMutation.mutate()
  }

  const handlePublish = (projectId: number) => {
    console.log('🎯 Publishing project:', projectId)
    publishMutation.mutate(projectId)
  }

  const openTZModal = (project: Project) => {
    console.log('🎯 Opening TZ modal for project:', project.id)
    setSelectedProject(project)
    setIsTZModalOpen(true)
    setTzGenerationTaskId(null) // Сбрасываем task ID
  }

  const handleGenerateTZ = () => {
    if (!selectedProject) return
    console.log('🎯 Generating TZ for project:', selectedProject.id)
    generateTZMutation.mutate()
  }

  if (isLoadingProjects) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    )
  }

  return (
    <div className="px-6 pb-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Каталог проектов для студентов</h1>
          <p className="text-text-secondary mt-1 text-sm">Фаза 5. Управление сгенерированными техническими заданиями</p>
        </div>
        <Button size="sm" className="gap-2" onClick={openCreateModal}>
          <Plus size={16} /> Создать проект
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const isPublished = project.status === 'published'
          const isPublishing = publishMutation.isPending
          
          return (
            <Card key={project.id} className="flex flex-col p-5 hover:shadow-md transition-shadow h-full border border-border bg-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Lock size={12} />
                  <span>{getCompanyName(project.partner_company_id)}</span>
                </div>
                <Badge variant={getLevelBadgeVariant(project.difficulty)} className="text-xs px-2 py-0.5 font-medium">
                  {getLevelLabel(project.difficulty)}
                </Badge>
              </div>

              <h3 className="text-base font-semibold text-text-primary mb-4 min-h-[48px] leading-snug">
                {project.title}
              </h3>

              <div className="mb-3">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Роли</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="text-xs bg-slate-800 text-white border-0 px-2 py-0.5 font-medium">Backend</Badge>
                  <Badge className="text-xs bg-slate-800 text-white border-0 px-2 py-0.5 font-medium">Analyst</Badge>
                </div>
              </div>

              <div className="mb-4 flex-grow">
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Компетенции</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 border-0 font-medium">Python</Badge>
                  <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 border-0 font-medium">React</Badge>
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-4 border-t border-border">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="flex-1 h-9 text-xs font-medium"
                  onClick={() => openTZModal(project)}
                >
                  <FileText size={14} className="mr-1.5" /> Просмотреть ТЗ
                </Button>
                <Button 
                  variant={isPublished ? 'secondary' : 'primary'}
                  size="sm" 
                  className={`flex-1 h-9 text-xs font-medium transition-all ${
                    isPublished ? 'opacity-80' : ''
                  }`}
                  onClick={() => handlePublish(project.id)}
                  disabled={isPublished || isPublishing}
                >
                  {isPublishing ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : isPublished ? (
                    <CheckCircle size={14} className="mr-1.5" />
                  ) : (
                    <CheckCircle size={14} className="mr-1.5" />
                  )}
                  {isPublishing ? 'Публикация...' : isPublished ? 'Опубликован' : 'Опубликовать'}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {projects.length === 0 && !isLoadingProjects && (
        <div className="text-center py-16 text-text-secondary">
          <FileText size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">Проектов пока нет</p>
        </div>
      )}

      {/* 🔥 TZ Modal */}
      <Modal 
        isOpen={isTZModalOpen} 
        onClose={() => {
          setIsTZModalOpen(false)
          setTzGenerationTaskId(null)
          setIsGeneratingTZ(false)
        }} 
        title="Техническое задание" 
        size="lg"
      >
        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : projectDetail?.technical_spec ? (
          <div className="p-4 bg-slate-50 rounded-lg text-sm text-text-primary whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed border border-border">
            {projectDetail.technical_spec}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">ТЗ ещё не сгенерировано</h3>
            <p className="text-sm text-text-secondary mb-6 max-w-md mx-auto">
              Запустите генерацию, чтобы ИИ-агент создал подробное техническое задание. Это может занять несколько минут.
            </p>
            <Button 
              onClick={handleGenerateTZ} 
              disabled={isGeneratingTZ || generateTZMutation.isPending}
              className="gap-2"
              size="lg"
            >
              {isGeneratingTZ || generateTZMutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Сгенерировать ТЗ
                </>
              )}
            </Button>
            {generateTZMutation.error && (
              <p className="text-sm text-red-500 mt-3 px-4">
                {String(generateTZMutation.error)}
              </p>
            )}
            {isGeneratingTZ && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Идёт генерация ТЗ... Это может занять 2-5 минут. Не закрывайте окно.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 🔥 Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Новый проект"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Отмена</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Создать
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Название проекта *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-light outline-none"
              placeholder="Например: Система рекомендаций товаров"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-light outline-none resize-none"
              placeholder="Краткое описание целей проекта..."
              disabled={formData.generateSpec}
            />
            {formData.generateSpec && (
              <p className="text-xs text-text-secondary mt-1">Описание будет сгенерировано автоматически</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Сложность</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value as any }))}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-light outline-none"
              >
                <option value="easy">Начальный</option>
                <option value="medium">Средний</option>
                <option value="hard">Продвинутый</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Партнёр</label>
              <select
                value={formData.partner_company_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, partner_company_id: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-light outline-none"
              >
                <option value="">Не выбран</option>
                {companiesList.map((company: any) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.generateSpec}
              onChange={(e) => setFormData(prev => ({ ...prev, generateSpec: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">Сгенерировать ТЗ автоматически</p>
              <p className="text-xs text-text-secondary">ИИ создаст описание, ТЗ и предложит роли</p>
            </div>
            {formData.generateSpec && <Sparkles size={16} className="text-primary" />}
          </label>

          {formData.generateSpec && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Приоритетная область</label>
              <input
                type="text"
                value={formData.priority_area}
                onChange={(e) => setFormData(prev => ({ ...prev, priority_area: e.target.value }))}
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-light outline-none"
                placeholder="Например: Разработка ПО, Анализ данных..."
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}