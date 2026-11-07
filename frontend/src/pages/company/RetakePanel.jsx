import { useCallback, useEffect, useState } from 'react'
import Alert from '../../components/Alert'
import ConfirmDialog from '../../components/ConfirmDialog'
import Field from '../../components/Field'
import { api, errorMessage } from '../../services/api'

const COPY = {
  round1: {
    title: 'Reset Round 1 (video interview)?',
    warn: 'This permanently deletes the candidate\'s recordings, transcripts and AI report. They get a fresh 7-day invitation and must give recording consent again.',
    label: 'Reset Round 1',
  },
  round2: {
    title: 'Reset Round 2 (MCQ test)?',
    warn: 'This deletes the candidate\'s test and score. They get a new set of questions and a fresh timer when they start.',
    label: 'Reset Round 2',
  },
}

export default function RetakePanel({ appId, onChanged }) {
  const [info, setInfo] = useState(null)
  const [pending, setPending] = useState(null) // 'round1' | 'round2'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.company.get(`/api/company/applications/${appId}/retake-info`)
      setInfo(data)
    } catch { /* panel na ashleo page kaj korbe */ }
  }, [appId])

  useEffect(() => { load() }, [load])

  const close = () => { if (!busy) { setPending(null); setReason(''); } }

  const confirm = async () => {
    const which = pending
    setBusy(true)
    setError('')
    setOk('')
    try {
      const { data } = await api.company.post(
        `/api/company/applications/${appId}/reset-${which}`, { reason: reason.trim() },
      )
      setOk(`${which === 'round1' ? 'Round 1' : 'Round 2'} was reset. The candidate was emailed. ${data.remaining} reset(s) left for this round.`)
      setPending(null)
      setReason('')
      await load()
      onChanged?.()
    } catch (e) {
      setError(errorMessage(e))
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  if (!info) return null

  const row = (key, label) => {
    const r = info[key]
    return (
      <li key={key}>
        <span>
          {label}
          <span className="muted"> · {r.used} of {info.limit} resets used</span>
          {r.blocked_reason && <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>{r.blocked_reason}</span>}
        </span>
        <button className="btn btn-danger btn-sm" disabled={!r.can_reset} onClick={() => { setError(''); setOk(''); setPending(key) }}>
          Reset
        </button>
      </li>
    )
  }

  return (
    <section className="card">
      <h2>Technical problem? Let the candidate retry</h2>
      <p className="muted">
        Use this if the candidate had a network, camera or device problem. Your reason and the earlier score are saved in the audit log.
      </p>
      <Alert>{error}</Alert>
      <Alert type="success">{ok}</Alert>
      <ul className="doc-list">
        {row('round1', 'Round 1: video interview')}
        {row('round2', 'Round 2: MCQ test')}
      </ul>

      <ConfirmDialog
        open={Boolean(pending)} danger title={pending ? COPY[pending].title : ''}
        message={pending ? COPY[pending].warn : ''}
        confirmLabel={busy ? 'Resetting...' : pending ? COPY[pending].label : ''}
        confirmDisabled={busy || reason.trim().length < 5}
        onConfirm={confirm} onCancel={close}
      >
        <Field id="reset-reason" label="Reason (required, saved in the audit log)">
          <textarea id="reset-reason" value={reason} maxLength={300} style={{ minHeight: 80 }}
            onChange={(e) => setReason(e.target.value)} placeholder="e.g. Candidate lost internet during the interview" />
        </Field>
      </ConfirmDialog>
    </section>
  )
}
