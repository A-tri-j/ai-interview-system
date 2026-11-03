import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Alert from '../components/Alert'
import Field from '../components/Field'
import PasswordInput from '../components/PasswordInput'
import { api, errorMessage } from '../services/api'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/

export default function ResetPassword() {
  const [params] = useSearchParams()
  const role = params.get('role') === 'company' ? 'company' : 'candidate'
  const token = params.get('token') || ''
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const loginPath = role === 'company' ? '/company/login' : '/login'

  if (token.length < 20) {
    return (
      <div className="container">
        <div className="card form-card">
          <h1>Invalid reset link</h1>
          <p className="muted">This link is incomplete. Please request a new one.</p>
          <Link className="btn btn-primary" to={`/forgot-password?role=${role}`}>Request new link</Link>
        </div>
      </div>
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const errs = {}
    if (!PASSWORD_RULE.test(pw)) errs.pw = 'At least 8 characters with an uppercase letter, a lowercase letter and a number'
    if (pw !== pw2) errs.pw2 = 'Passwords do not match'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      await api.public.post(`/api/auth/${role}/reset-password`, { token, new_password: pw, confirm_password: pw2 })
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Choose a new password</h1>
        {done ? (
          <>
            <Alert type="success">Password updated. You can sign in now.</Alert>
            <Link className="btn btn-primary" to={loginPath}>Go to sign in</Link>
          </>
        ) : (
          <>
            <Alert>{error}</Alert>
            <Field id="rp-pw" label="New password" error={errors.pw}>
              <PasswordInput id="rp-pw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" invalid={!!errors.pw} />
            </Field>
            <Field id="rp-pw2" label="Confirm new password" error={errors.pw2}>
              <PasswordInput id="rp-pw2" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" invalid={!!errors.pw2} />
            </Field>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Saving...' : 'Update password'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}

