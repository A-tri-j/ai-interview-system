// Candidate-er saved job id-gulo. Heart button optimistic: age UI bodlay, fail hole ferot.
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { api, errorMessage } from '../services/api'

export const SavedContext = createContext(null)

export function SavedProvider({ children }) {
  const { users } = useAuth()
  const cid = users.candidate?.id
  const [ids, setIds] = useState([])

  useEffect(() => {
    if (!cid) { setIds([]); return }
    let alive = true
    api.candidate.get('/api/saved/ids').then((r) => alive && setIds(r.data.ids)).catch(() => {})
    return () => { alive = false }
  }, [cid])

  // Returns error message on failure, or null on success
  const toggle = useCallback(async (id) => {
    const was = ids.includes(id)
    setIds((p) => (was ? p.filter((x) => x !== id) : [...p, id]))
    try {
      if (was) await api.candidate.delete(`/api/saved/${id}`)
      else await api.candidate.post(`/api/saved/${id}`)
      return null
    } catch (e) {
      setIds((p) => (was ? [...p, id] : p.filter((x) => x !== id)))
      return errorMessage(e)
    }
  }, [ids])

  const value = useMemo(() => ({ ids, toggle }), [ids, toggle])
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
}

