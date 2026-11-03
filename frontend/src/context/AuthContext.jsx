// Ke login ache (candidate / company / admin) ta ekhane thake.
// Protita role-er token alada, tai ekshathe tin-jon login thakte pare (alada tab-e).
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../services/api'

export const AuthContext = createContext(null)

const ME = {
  candidate: '/api/auth/candidate/me',
  company: '/api/auth/company/me',
  admin: '/api/admin/me',
}
const EMPTY = { candidate: null, company: null, admin: null }
const REFRESH_MS = 30 * 60 * 1000 // active thakle 30 minute por por token notun kori

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
      setUser(role, null) // 401 hole interceptor token age-i muche dise
      return null
    }
  }, [setUser])

  // Sliding session: backend notun token dey (candidate 30 din, company 24 ghonta)
  const refresh = useCallback(async (role) => {
    if (!tokenStore.get(role)) return
    try {
      const { data } = await api[role].post('/api/auth/refresh')
      tokenStore.set(role, data.access_token)
    } catch { /* fail hole purano token cholbe, expire holei logout */ }
  }, [])

  // Site khulle: save kora token thakle user load kori
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

