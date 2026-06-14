import { create } from 'zustand'
import type { PlatformAuthPayload } from '@/lib/platform-bridge'
import type { UserRead } from '@/api/types'  // ← импортируем тип

type Locale = 'ru' | 'en'

interface AppState {
  // === Аутентификация ===
  auth: PlatformAuthPayload | null
  setAuth: (auth: PlatformAuthPayload | null) => void
  
  // === Данные пользователя ===
  user: UserRead | null  // ← новое поле
  setUser: (user: UserRead | null) => void

  // === Локализация ===
  locale: Locale
  setLocale: (l: Locale) => void

  // === UI State ===
  ui: { 
    sidebarOpen: boolean 
    analysisApproved: boolean 
  }
  toggleSidebar: () => void
  setAnalysisApproved: (val: boolean) => void

  // === Конфигурация агента ===
  agentConfig: { 
    tone: 'formal' | 'informal'
    model: string 
  }
  setTone: (tone: 'formal' | 'informal') => void

  // === Toast уведомления ===
  toasts: { 
    id: string
    message: string
    type: 'success' | 'error' | 'info'
  }[]
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  // === Аутентификация ===
  auth: null,
  setAuth: (auth) => set({ auth }),

  // === Данные пользователя ===
  user: null,
  setUser: (user) => set({ user }),

  // === Локализация ===
  locale: 'ru',
  setLocale: (l) => set({ locale: l }),

  // === UI State ===
  ui: { 
    sidebarOpen: true, 
    analysisApproved: false 
  },
  toggleSidebar: () => set((s) => ({ 
    ui: { ...s.ui, sidebarOpen: !s.ui.sidebarOpen } 
  })),
  setAnalysisApproved: (val) => set((s) => ({ 
    ui: { ...s.ui, analysisApproved: val } 
  })),

  // === Конфигурация агента ===
  agentConfig: { 
    tone: 'formal', 
    model: 'GigaChat' 
  },
  setTone: (tone) => set((s) => ({ 
    agentConfig: { ...s.agentConfig, tone } 
  })),

  // === Toast уведомления ===
  toasts: [],
  addToast: (message, type) => {
    const id = Date.now().toString()
    set((s) => ({ 
      toasts: [...s.toasts, { id, message, type }] 
    }))
    setTimeout(() => {
      set((s) => ({ 
        toasts: s.toasts.filter((t) => t.id !== id) 
      }))
    }, 4000)
  },
  removeToast: (id) => set((s) => ({ 
    toasts: s.toasts.filter((t) => t.id !== id) 
  })),
}))