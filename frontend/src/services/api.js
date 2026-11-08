// HTTP API layer. Provides isolated Axios instances per role to prevent token collisions.
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export const tokenStore = {
  get: (role) => {
    try { return localStorage.getItem(`token_${role}`) } catch { return null }
  },
  set: (role, token) => {
    try { localStorage.setItem(`token_${role}`, token) } catch { /* ignore */ }
  },
  clear: (role) => {
    try { localStorage.removeItem(`token_${role}`) } catch { /* ignore */ }
  },
}

function make(role) {
  // 60s timeout: accommodates initial model load during AI processing
  const instance = axios.create({ baseURL: BASE_URL, timeout: 60000 })
  if (role) {
    instance.interceptors.request.use((cfg) => {
      const token = tokenStore.get(role)
      if (token) cfg.headers.Authorization = `Bearer ${token}`
      return cfg
    })
    instance.interceptors.response.use(
      (res) => res,
      (err) => {
        // Clear token on 401 Unauthorized
        if (err.response?.status === 401 && tokenStore.get(role)) {
          tokenStore.clear(role)
          window.dispatchEvent(new CustomEvent('auth:expired', { detail: role }))
        }
        return Promise.reject(err)
      },
    )
  }
  return instance
}

export const api = {
  public: make(null),       // Public endpoints (vacancy list, login, register)
  candidate: make('candidate'),
  company: make('company'),
  admin: make('admin'),
}

// Formats FastAPI validation errors into user-friendly strings
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (err?.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection.'
  if (err?.code === 'ECONNABORTED') return 'The request took too long. Please try again.'
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msg = detail
      .map((d) => (d.msg || '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join('. ')
    if (msg) return msg
  }
  return fallback
}

