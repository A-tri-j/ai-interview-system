import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import PasswordInput from '../../components/PasswordInput'
import { useAuth } from '../../hooks/useAuth'
import { api, errorMessage, tokenStore } from '../../services/api'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/

function ChangePassword() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setOk('')
    const errs = {}
    if (!f.current) errs.current = 'Enter your current password'
    if (!PASSWORD_RULE.test(f.next)) errs.next = 'At least 8 characters with an uppercase letter, a lowercase letter and a number'
    if (f.next !== f.confirm) errs.confirm = 'Passwords do not match'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const { data } = await api.candidate.post('/api/candidates/me/change-password', {
        current_password: f.current, new_password: f.next, confirm_password: f.confirm,
      })
      // Purano token batil hoye gese, backend notun token dey: logout hobe na
      if (data.access_token) tokenStore.set('candidate', data.access_token)
      setOk('Password changed.')
      setF({ current: '', next: '', confirm: '' })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Change password</h2>
      <Alert>{error}</Alert>
      <Alert type="success">{ok}</Alert>
      <Field id="cp-cur" label="Current password" error={errors.current}>
        <PasswordInput id="cp-cur" value={f.current} onChange={set('current')} autoComplete="current-password" invalid={!!errors.current} />
      </Field>
      <Field id="cp-new" label="New password" error={errors.next}>
        <PasswordInput id="cp-new" value={f.next} onChange={set('next')} autoComplete="new-password" invalid={!!errors.next} />
      </Field>
      <Field id="cp-conf" label="Confirm new password" error={errors.confirm}>
        <PasswordInput id="cp-conf" value={f.confirm} onChange={set('confirm')} autoComplete="new-password" invalid={!!errors.confirm} />
      </Field>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</button>
    </form>
  )
}

function DeleteAccount() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!password) return setError('Enter your password')
    if (confirm !== 'DELETE') return setError('Type DELETE to confirm')
    if (!window.confirm('Permanently delete your account, applications, CV and recordings? This cannot be undone.')) return
    setBusy(true)
    try {
      await api.candidate.post('/api/candidates/me/delete-account', { password, confirm: 'DELETE' })
      logout('candidate')
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="card danger-zone" onSubmit={submit} noValidate>
      <h2>Privacy and account deletion</h2>
      <p className="muted">
        Your CV, interview recordings and report are visible only to the company you applied to.
        Recordings are deleted automatically after the retention period in your interview consent notice.
        You can delete individual recordings from the interview result under "My applications".
      </p>
      <p>Deleting your account permanently removes your profile, applications, CV, recordings and interview data.</p>
      <Alert>{error}</Alert>
      <Field id="da-pw" label="Your password">
        <PasswordInput id="da-pw" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field id="da-conf" label="Type DELETE to confirm">
        <input id="da-conf" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
      </Field>
      <button className="btn btn-danger" disabled={busy || confirm !== 'DELETE'}>
        {busy ? 'Deleting...' : 'Delete my account'}
      </button>
    </form>
  )
}

export default function SettingsTab() {
  return (
    <div className="stack">
      <ChangePassword />
      <DeleteAccount />
    </div>
  )
}
