import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import PasswordInput from '../../components/PasswordInput'
import ThemeToggle from '../../components/ThemeToggle'
import { useAuth } from '../../hooks/useAuth'
import { api, errorMessage } from '../../services/api'

export default function AdminLogin() {
  const { users, loading, login } = useAuth()
  const location = useLocation()
  const from = location.state?.from || '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && users.admin) return <Navigate to={from} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) return setError('Enter your email and password')
    setBusy(true)
    try {
      const { data } = await api.public.post('/api/admin/login', {
        email: email.trim().toLowerCase(), password,
      })
      const me = await login('admin', data.access_token)
      if (!me) setError('Could not load the admin account.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container admin-login">
      <div className="admin-login-top"><ThemeToggle simple /></div>
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Admin sign in</h1>
        <Alert>{error}</Alert>
        <Field id="ad-email" label="Admin email">
          <input id="ad-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </Field>
        <Field id="ad-pw" label="Password">
          <PasswordInput id="ad-pw" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
