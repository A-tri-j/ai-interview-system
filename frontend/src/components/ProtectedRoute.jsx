// Guards private routes from unauthenticated users. Backend also enforces authorization checks.
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Spinner from './Spinner'

const LOGIN_PATH = { candidate: '/login', company: '/company/login', admin: '/admin/login' }

export default function ProtectedRoute({ role, children }) {
  const { users, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!users[role]) {
    return <Navigate to={LOGIN_PATH[role]} replace state={{ from: location.pathname + location.search }} />
  }
  return children
}

