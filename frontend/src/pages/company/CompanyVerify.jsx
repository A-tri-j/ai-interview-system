import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import { api, errorMessage } from '../../services/api'

export default function CompanyVerify() {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState(params.get('email') || '')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState(location.state?.justRegistered ? 'We sent a 6-digit code to your company email.' : '')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(location.state?.justRegistered ? 30 : 0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address')
    if (!/^\d{6}$/.test(otp)) return setError('Enter the 6-digit code')
    setBusy(true)
    try {
      await api.public.post('/api/auth/company/verify-email', { email: email.trim().toLowerCase(), otp })
      navigate('/company/login', {
        state: { notice: 'Email verified. Your company is waiting for admin approval. You can sign in meanwhile.' },
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setInfo('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address')
    try {
      await api.public.post('/api/auth/company/resend-otp', { email: email.trim().toLowerCase() })
      setInfo('If the account exists, a new code has been sent.')
      setCooldown(30)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="container">
      <form className="card form-card" onSubmit={submit} noValidate>
        <h1>Verify company email</h1>
        <Alert>{error}</Alert>
        <Alert type="info">{info}</Alert>
        <Field id="cv-email" label="Company email">
          <input id="cv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field id="cv-otp" label="Verification code" hint="The code expires in 10 minutes.">
          <input id="cv-otp" value={otp} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
        </Field>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Verifying...' : 'Verify email'}</button>
        <p style={{ marginTop: 16 }}>
          <button type="button" className="link-btn" onClick={resend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </p>
        <p className="muted"><Link to="/company/login">Back to sign in</Link></p>
      </form>
    </div>
  )
}

