import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import Dashboard from '@/pages/Dashboard'
import Analysis from '@/pages/Analysis'
import Companies from '@/pages/Companies'
import Communications from '@/pages/Communications'
import Projects from '@/pages/Projects'
import Memory from '@/pages/Memory'
import Settings from '@/pages/Settings'
import NotFound from '@/pages/NotFound'
import Register from '@/pages/Register'
import Login from '@/pages/Login'
import ProtectedRoute from '@/components/ProtectedRoute'

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  
  // Protected routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'analysis', element: <Analysis /> },
      { path: 'companies', element: <Companies /> },
      { path: 'communications', element: <Communications /> },
      { path: 'projects', element: <Projects /> },
      { path: 'memory', element: <Memory /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> }
    ]
  },
])