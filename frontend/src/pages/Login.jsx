import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Alert from '../components/Alert'
import Field from '../components/Field'
import PasswordInput from '../components/PasswordInput'
import { useAuth } from '../hooks/useAuth'
import { api, errorMessage } from '../services/api'

export default function Login() {
  const { users, loading, login } = useAuth()
  const location = useLocation()
  const from = location.state?.from || '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [busy, setBusy] = useState(false)

  // Login hoye gele ba age-i login thakle: je page theke eshechilo shekhane pathai
  if (!loading && users.candidate) return <Navigate to={from} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNeedsVerify(false)
    if (!email.trim() || !password) return setError('Enter your email and password')
    setBusy(true)
    try {
      const { data } = await api.public.post('/api/auth/candidate/login', {
        email: email.trim().toLowerCase(), password,
      })
      const me = await login('candidate', data.access_token)
      if (!me) setError('Could not load your account. Please try again.')
    } catch (err) {
      setError(errorMessage(err))
      if (err.response?.status === 403 && /verify/i.test(err.response?.data?.detail || '')) setNeedsVerify(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Sign in</h1>
        <Alert type="success">{location.state?.notice}</Alert>
        <Alert>{error}</Alert>
        {needsVerify && (
          <p><Link to={`/verify-email?email=${encodeURIComponent(email.trim())}`}>Verify your email now</Link></p>
        )}

        <Field id="l-email" label="Email address">
          <input id="l-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field id="l-pw" label="Password">
          <PasswordInput id="l-pw" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
        <p style={{ marginTop: 16 }}><Link to="/forgot-password?role=candidate">Forgot your password?</Link></p>
        <p className="muted">New here? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  )
}

