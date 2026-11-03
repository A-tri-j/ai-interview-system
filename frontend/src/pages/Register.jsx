import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../components/Alert'
import Field from '../components/Field'
import PasswordInput from '../components/PasswordInput'
import { api, errorMessage } from '../services/api'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/

export function validateRegister(f) {
  const e = {}
  if (f.full_name.trim().length < 2) e.full_name = 'Enter your full name'
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address'
  if (!/^\+?[0-9]{7,15}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid phone number (7 to 15 digits)'
  if (!PASSWORD_RULE.test(f.password)) e.password = 'At least 8 characters with an uppercase letter, a lowercase letter and a number'
  if (f.confirm_password !== f.password) e.confirm_password = 'Passwords do not match'
  return e
}

export default function Register() {
  const [f, setF] = useState({ full_name: '', email: '', phone: '', password: '', confirm_password: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const errs = validateRegister(f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const email = f.email.trim().toLowerCase()
      await api.public.post('/api/auth/candidate/register', {
        full_name: f.full_name.trim(), email, phone: f.phone,
        password: f.password, confirm_password: f.confirm_password,
      })
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, { state: { justRegistered: true } })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        <Alert>{error}</Alert>

        <Field id="r-name" label="Full name" error={errors.full_name}>
          <input id="r-name" value={f.full_name} onChange={set('full_name')} autoComplete="name"
            maxLength={150} aria-invalid={!!errors.full_name || undefined} />
        </Field>
        <Field id="r-email" label="Email address" error={errors.email} hint="We will send a verification code here.">
          <input id="r-email" type="email" value={f.email} onChange={set('email')} autoComplete="email"
            aria-invalid={!!errors.email || undefined} />
        </Field>
        <Field id="r-phone" label="Phone number" error={errors.phone}>
          <input id="r-phone" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel"
            placeholder="+8801700000000" aria-invalid={!!errors.phone || undefined} />
        </Field>
        <Field id="r-pw" label="Password" error={errors.password}>
          <PasswordInput id="r-pw" value={f.password} onChange={set('password')}
            autoComplete="new-password" invalid={!!errors.password} />
        </Field>
        <Field id="r-pw2" label="Confirm password" error={errors.confirm_password}>
          <PasswordInput id="r-pw2" value={f.confirm_password} onChange={set('confirm_password')}
            autoComplete="new-password" invalid={!!errors.confirm_password} />
        </Field>

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Creating account...' : 'Create account'}
        </button>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}

