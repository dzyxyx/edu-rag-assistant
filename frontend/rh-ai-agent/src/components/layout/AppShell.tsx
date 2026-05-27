import { useEffect } from 'react'
import { Outlet, useLocation, Link } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, BarChart3, Building2, Mail, FolderKanban, Settings, 
  Menu, Bell, LogOut, Languages, BrainCircuit 
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { NotificationDropdown } from '@/components/ui/NotificationDropdown'
import { MiniAppBridge } from '@/lib/mini-app-bridge'

const NAV_ITEMS = [
  { icon: LayoutDashboard, key: 'nav.dashboard', path: '/' },
  { icon: BarChart3, key: 'nav.analysis', path: '/analysis' },
  { icon: Building2, key: 'nav.companies', path: '/companies' },
  { icon: Mail, key: 'nav.communications', path: '/communications' },
  { icon: FolderKanban, key: 'nav.projects', path: '/projects' },
  { icon: BrainCircuit, key: 'nav.memory', path: '/memory' },
  { icon: Settings, key: 'nav.settings', path: '/settings' }
]

export function AppShell() {
  const { ui, toggleSidebar, locale, setLocale } = useAppStore()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const [isNotifOpen, setIsNotifOpen] = useState(false)

  const handleLanguageToggle = () => {
    const newLang = locale === 'ru' ? 'en' : 'ru'
    setLocale(newLang)
    i18n.changeLanguage(newLang)
  }

  // Синхронизация высоты iframe с контентом (Mini App Bridge)
  useEffect(() => {
    const updateHeight = () => MiniAppBridge.updateHeight()
    
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [location.pathname])

  return (
    <div className="flex h-screen bg-surface overflow-hidden font-sans">
      <aside className={cn(
        'hidden md:flex flex-col w-64 bg-surface-dark text-white transition-all duration-300 border-r border-white/5',
        ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-20'
      )}>
        <div className="p-4 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold shrink-0">
            <BrainCircuit size={18} />
          </div>
          {ui.sidebarOpen && <span className="font-semibold text-lg truncate">ПроКомпетенции</span>}
        </div>
        
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ icon: Icon, key, path }) => (
            <Link key={path} to={path} className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group',
              location.pathname === path ? 'bg-primary/20 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
            )}>
              <Icon size={20} className="shrink-0" />
              {ui.sidebarOpen && <span className="truncate">{t(key)}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button className="flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white w-full transition-colors">
            <LogOut size={20} className="shrink-0" />
            {ui.sidebarOpen && <span>{locale === 'ru' ? 'Выйти' : 'Logout'}</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-surface-card flex items-center justify-between px-4 md:px-6 shrink-0">
          <button onClick={toggleSidebar} className="md:hidden p-2 hover:bg-slate-100 rounded-lg">
            <Menu size={20} />
          </button>
          
          <div className="hidden md:flex items-center gap-2 text-sm text-text-secondary">
            <span>Иванов А.С.</span>
            <span className="text-text-primary font-medium">Администратор УрФУ</span>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleLanguageToggle} className="h-8 w-8 p-0">
              <Languages size={18} />
            </Button>
            
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)} 
                className="p-2 hover:bg-slate-100 rounded-full relative transition-colors"
              >
                <Bell size={20} className="text-text-secondary" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>
              <NotificationDropdown isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
            </div>
            
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold ml-2">
              AI
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  )
}