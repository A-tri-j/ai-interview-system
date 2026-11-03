import { useState } from 'react'

export default function PasswordInput({ id, value, onChange, autoComplete, invalid }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-wrap">
      <input
        id={id} type={show ? 'text' : 'password'} value={value} onChange={onChange}
        autoComplete={autoComplete} maxLength={64} aria-invalid={invalid || undefined}
      />
      <button
        type="button" className="pw-toggle" onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}

