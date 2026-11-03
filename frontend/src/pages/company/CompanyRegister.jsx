import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../../components/Alert'
import Field from '../../components/Field'
import PasswordInput from '../../components/PasswordInput'
import { api, errorMessage } from '../../services/api'

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/
const EMPTY = {
  company_name: '', email: '', registration_number: '', manager_name: '',
  manager_designation: '', phone: '', industry: '', company_size: '11-50',
  address: '', website: '', description: '', password: '', confirm_password: '',
}

function validate(f) {
  const e = {}
  if (f.company_name.trim().length < 2) e.company_name = 'Enter the company name'
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid company email'
  if (f.registration_number.trim().length < 3) e.registration_number = 'Enter the company ID or registration number'
  if (f.manager_name.trim().length < 2) e.manager_name = 'Enter the manager name'
  if (f.manager_designation.trim().length < 2) e.manager_designation = 'Enter the manager designation'
  if (!/^\+?[0-9]{7,15}$/.test(f.phone.replace(/[\s-]/g, ''))) e.phone = 'Enter a valid phone number'
  if (f.industry.trim().length < 2) e.industry = 'Enter the industry'
  if (f.address.trim().length < 5) e.address = 'Enter the office address'
  if (f.website.trim() && !/^https?:\/\//.test(f.website.trim())) e.website = 'Must start with http:// or https://'
  if (!PASSWORD_RULE.test(f.password)) e.password = 'At least 8 characters with an uppercase letter, a lowercase letter and a number'
  if (f.confirm_password !== f.password) e.confirm_password = 'Passwords do not match'
  return e
}

export default function CompanyRegister() {
  const [f, setF] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const errs = validate(f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const email = f.email.trim().toLowerCase()
      await api.public.post('/api/auth/company/register', {
        company_name: f.company_name.trim(), email,
        registration_number: f.registration_number.trim(),
        manager_name: f.manager_name.trim(), manager_designation: f.manager_designation.trim(),
        phone: f.phone, industry: f.industry.trim(), company_size: f.company_size,
        address: f.address.trim(), website: f.website.trim() || null,
        description: f.description.trim() || null,
        password: f.password, confirm_password: f.confirm_password,
      })
      navigate(`/company/verify-email?email=${encodeURIComponent(email)}`, { state: { justRegistered: true } })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const text = (id, label, key, extra = {}) => (
    <Field id={id} label={label} error={errors[key]} hint={extra.hint}>
      <input id={id} value={f[key]} onChange={set(key)} type={extra.type || 'text'}
        autoComplete={extra.autoComplete} placeholder={extra.placeholder}
        aria-invalid={!!errors[key] || undefined} />
    </Field>
  )

  return (
    <div className="container">
      <form className="card form-card wide" onSubmit={submit} noValidate>
        <h1>Register your company</h1>
        <p className="muted">After you verify your email, our team reviews your company before you can publish vacancies.</p>
        <Alert>{error}</Alert>

        <div className="form-grid">
          {text('c-name', 'Company name', 'company_name')}
          {text('c-email', 'Company email', 'email', { type: 'email', autoComplete: 'email', hint: 'We send the verification code here.' })}
          {text('c-reg', 'Company ID / registration number', 'registration_number')}
          {text('c-mgr', 'Manager name', 'manager_name', { autoComplete: 'name' })}
          {text('c-desg', 'Manager designation', 'manager_designation')}
          {text('c-phone', 'Phone number', 'phone', { type: 'tel', autoComplete: 'tel', placeholder: '+8801800000000' })}
          {text('c-ind', 'Industry', 'industry')}
          <Field id="c-size" label="Company size">
            <select id="c-size" value={f.company_size} onChange={set('company_size')}>
              {['1-10', '11-50', '51-200', '201-1000', '1000+'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          {text('c-web', 'Website (optional)', 'website', { type: 'url', placeholder: 'https://' })}
        </div>

        <Field id="c-addr" label="Office address" error={errors.address}>
          <textarea id="c-addr" value={f.address} onChange={set('address')} maxLength={500} style={{ minHeight: 70 }} />
        </Field>
        <Field id="c-desc" label="Company description (optional)">
          <textarea id="c-desc" value={f.description} onChange={set('description')} maxLength={3000} />
        </Field>

        <div className="form-grid">
          <Field id="c-pw" label="Password" error={errors.password}>
            <PasswordInput id="c-pw" value={f.password} onChange={set('password')} autoComplete="new-password" invalid={!!errors.password} />
          </Field>
          <Field id="c-pw2" label="Confirm password" error={errors.confirm_password}>
            <PasswordInput id="c-pw2" value={f.confirm_password} onChange={set('confirm_password')} autoComplete="new-password" invalid={!!errors.confirm_password} />
          </Field>
        </div>

        <button className="btn btn-primary" disabled={busy}>{busy ? 'Registering...' : 'Register company'}</button>
        <p className="muted" style={{ marginTop: 16 }}>
          Already registered? <Link to="/company/login">Company sign in</Link>
        </p>
      </form>
    </div>
  )
}

