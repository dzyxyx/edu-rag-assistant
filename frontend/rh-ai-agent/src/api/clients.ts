import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'


export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 10000, 
  withCredentials: false,
  transformResponse: [(data: string) => {
    try {
      return JSON.parse(data)
    } catch (e) {
      console.warn('Failed to parse response:', data)
      return data
    }
  }],
})

export const chatClient = axios.create({
  baseURL: API_URL,
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 300000, 
  withCredentials: false,
})

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    if (import.meta.env.DEV) {
      console.log('📤 API Request:', {
        method: config.method?.toUpperCase(),
        url: config.url,
        headers: config.headers,
        data: config.data,
      })
    }
    
    return config
  },
  (error) => {
    console.error('❌ Request interceptor error:', error)
    return Promise.reject(error)
  }
)

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      console.log('📥 API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
      })
    }
    return response
  },
  (error: AxiosError) => {
    if (import.meta.env.DEV) {
      console.error('❌ API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.message,
        code: error.code,
        data: error.response?.data,
        headers: error.response?.headers,
        config: {
          baseURL: error.config?.baseURL,
          url: error.config?.url,
          timeout: error.config?.timeout,
        }
      })
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timeout:', {
        url: error.config?.url,
        timeout: error.config?.timeout,
      })
    }
    
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

chatClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

chatClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (import.meta.env.DEV) {
      console.error('Chat API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      })
    }
    return Promise.reject(error)
  }
)

export default apiClient