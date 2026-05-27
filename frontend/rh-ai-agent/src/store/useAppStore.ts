import { create } from 'zustand'

type Locale = 'ru' | 'en'

interface AppState {
  locale: Locale
  setLocale: (l: Locale) => void

  ui: { sidebarOpen: boolean; analysisApproved: boolean }
  toggleSidebar: () => void
  setAnalysisApproved: (val: boolean) => void

  agentConfig: { tone: 'formal' | 'informal'; model: string }
  setTone: (tone: 'formal' | 'informal') => void

  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[]
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  locale: 'ru',
  setLocale: (l) => set({ locale: l }),

  ui: { sidebarOpen: true, analysisApproved: false },
  toggleSidebar: () => set((s) => ({ ui: { ...s.ui, sidebarOpen: !s.ui.sidebarOpen } })),
  setAnalysisApproved: (val) => set((s) => ({ ui: { ...s.ui, analysisApproved: val } })),

  agentConfig: { tone: 'formal', model: 'GigaChat' },
  setTone: (tone) => set((s) => ({ agentConfig: { ...s.agentConfig, tone } })),

  toasts: [],
  addToast: (message, type) => {
    const id = Date.now().toString()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))