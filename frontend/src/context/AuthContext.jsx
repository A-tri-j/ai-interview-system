// Tracks active authentication state for candidate, company, and admin roles.
// Each role maintains an isolated token store, enabling concurrent sessions in separate tabs.
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../services/api'

export const AuthContext = createContext(null)

const ME = {
  candidate: '/api/auth/candidate/me',
  company: '/api/auth/company/me',
  admin: '/api/admin/me',
}
const EMPTY = { candidate: null, company: null, admin: null }
const REFRESH_MS = 30 * 60 * 1000 // Refresh active session token every 30 minutes

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(EMPTY)
  const [loading, setLoading] = useState(true)

  const setUser = useCallback((role, user) => setUsers((p) => ({ ...p, [role]: user })), [])

  const loadMe = useCallback(async (role) => {
    try {
      const { data } = await api[role].get(ME[role])
      setUser(role, data)
      return data
    } catch {
      setUser(role, null) // On 401, axios interceptor removes token
      return null
    }
  }, [setUser])

  // Sliding session: backend returns a refreshed access token
  const refresh = useCallback(async (role) => {
    if (!tokenStore.get(role)) return
    try {
      const { data } = await api[role].post('/api/auth/refresh')
      tokenStore.set(role, data.access_token)
    } catch { /* If refresh fails, keep current token until expiration */ }
  }, [])

  // On mount: restore user profile if an existing token is stored
  useEffect(() => {
    let alive = true
    const roles = Object.keys(ME).filter((r) => tokenStore.get(r))
    Promise.all(
      roles.map(async (r) => {
        const me = await loadMe(r)
        if (me && r !== 'admin') await refresh(r)
      }),
    ).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [loadMe, refresh])

  // Onno jaygay 401 hole logout
  useEffect(() => {
    const onExpired = (e) => setUser(e.detail, null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [setUser])

  useEffect(() => {
    const id = setInterval(() => {
      refresh('candidate')
      refresh('company')
    }, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  const login = useCallback(async (role, token) => {
    tokenStore.set(role, token)
    return loadMe(role)
  }, [loadMe])

  const logout = useCallback((role) => {
    tokenStore.clear(role)
    setUser(role, null)
  }, [setUser])

  const value = useMemo(
    () => ({ users, loading, login, logout, reload: loadMe }),
    [users, loading, login, logout, loadMe],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

