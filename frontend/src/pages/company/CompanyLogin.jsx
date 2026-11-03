// Step 1: email + password. Step 2: email-e ashha 6-digit code. Tarpor-i login hoy.
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import PasswordInput from '../../components/PasswordInput'
import { useAuth } from '../../hooks/useAuth'
import { api, errorMessage } from '../../services/api'

export default function CompanyLogin() {
  const { users, loading, login } = useAuth()
  const location = useLocation()
  const from = location.state?.from || '/company'
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  if (!loading && users.company) return <Navigate to={from} replace />

  const sendCode = async () => {
    await api.public.post('/api/auth/company/login', { email: email.trim().toLowerCase(), password })
    setCooldown(30)
  }

  const submitStep1 = async (e) => {
    e.preventDefault()
    setError('')
    setNeedsVerify(false)
    if (!email.trim() || !password) return setError('Enter your email and password')
    setBusy(true)
    try {
      await sendCode()
      setInfo('We sent a login code to your company email.')
      setStep(2)
    } catch (err) {
      setError(errorMessage(err))
      if (err.response?.status === 403 && /verify/i.test(err.response?.data?.detail || '')) setNeedsVerify(true)
    } finally {
      setBusy(false)
    }
  }

  const submitStep2 = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code')
    setBusy(true)
    try {
      const { data } = await api.public.post('/api/auth/company/login/verify', {
        email: email.trim().toLowerCase(), otp,
      })
      const me = await login('company', data.access_token)
      if (!me) setError('Could not load your account. Please try again.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    try {
      await sendCode()
      setInfo('A new code has been sent.')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="container">
      <form className="card form-card" onSubmit={step === 1 ? submitStep1 : submitStep2} noValidate>
        <h1>Company sign in</h1>
        <Alert type="success">{location.state?.notice}</Alert>
        <Alert>{error}</Alert>
        <Alert type="info">{info}</Alert>
        {needsVerify && <p><Link to={`/company/verify-email?email=${encodeURIComponent(email.trim())}`}>Verify your company email</Link></p>}

        {step === 1 ? (
          <>
            <Field id="cl-email" label="Company email">
              <input id="cl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field id="cl-pw" label="Password">
              <PasswordInput id="cl-pw" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Checking...' : 'Continue'}</button>
            <p style={{ marginTop: 16 }}><Link to="/forgot-password?role=company">Forgot your password?</Link></p>
            <p className="muted">New company? <Link to="/company/register">Register here</Link></p>
          </>
        ) : (
          <>
            <Field id="cl-otp" label="Login code" hint="Sent to your company email. Expires in 10 minutes.">
              <input id="cl-otp" value={otp} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            </Field>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
            <p style={{ marginTop: 16 }}>
              <button type="button" className="link-btn" onClick={resend} disabled={cooldown > 0}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
              </button>
            </p>
            <p className="muted"><button type="button" className="link-btn" onClick={() => { setStep(1); setOtp(''); setError(''); setInfo('') }}>Use a different account</button></p>
          </>
        )}
      </form>
    </div>
  )
}

