import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '../components/Alert'
import Field from '../components/Field'
import { api, errorMessage } from '../services/api'

export default function ForgotPassword() {
  const [params] = useSearchParams()
  const role = params.get('role') === 'company' ? 'company' : 'candidate'
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address')
    setBusy(true)
    try {
      await api.public.post(`/api/auth/${role}/forgot-password`, { email: email.trim().toLowerCase() })
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Reset your password</h1>
        {sent ? (
          <Alert type="success">If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.</Alert>
        ) : (
          <>
            <Alert>{error}</Alert>
            <Field id="fp-email" label="Email address">
              <input id="fp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Sending...' : 'Send reset link'}
            </button>
          </>
        )}
        <p className="muted" style={{ marginTop: 16 }}>
          <Link to={role === 'company' ? '/company/login' : '/login'}>Back to sign in</Link>
        </p>
      </form>
    </div>
  )
}
