import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'

const API_URL = import.meta.env.VITE_API_URL 

export const apiClient = axios.create({
  baseURL: API_URL || 'http://localhost:8000/api/v1',
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
  // 🔥 Важно для CORS с credentials
  withCredentials: false,
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 🔥 Логируем ошибки для отладки, но не ломаем UI
    if (import.meta.env.DEV) {
      console.error('API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
      })
    }
    
    // 401 — неавторизован, можно редиректить на логин
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      // Не делаем редирект автоматически — пусть страница просто покажет пустые данные
    }
    
    return Promise.reject(error)
  }
)

export default apiClient