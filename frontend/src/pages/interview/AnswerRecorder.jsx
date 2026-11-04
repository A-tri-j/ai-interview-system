// Ekta question-er answer: record, preview, upload (retry), skip.
import { useCallback, useEffect, useRef, useState } from 'react'
import Alert from '../../components/Alert'
import { api, errorMessage } from '../../services/api'
import { LiveVideo, MicMeter } from './media'

const MIN_SECONDS = 2
const fmt = (t) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`

// Browser je format support kore sheta-i nei (Chrome=webm, Safari=mp4)
function pickMime(mode) {
  if (typeof MediaRecorder === 'undefined') return null
  const list = mode === 'video'
    ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
    : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return list.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

export default function AnswerRecorder({ applicationId, question, index, total, mode, stream, maxSec, onDone }) {
  const [rs, setRs] = useState('idle') // idle | recording | paused | recorded
  const [elapsed, setElapsed] = useState(0)
  const [blob, setBlob] = useState(null)
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')
  const [silent, setSilent] = useState(false)
  const [uploading, setUploading] = useState(false)
  const recRef = useRef(null)
  const chunks = useRef([])
  const canPause = typeof MediaRecorder !== 'undefined' && 'pause' in MediaRecorder.prototype

  // Timer shudhu recording cholar somoy cholbe (pause-e thambe)
  useEffect(() => {
    if (rs !== 'recording') return
    const id = setInterval(() => setElapsed((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [rs])

  const stop = useCallback(() => {
    const r = recRef.current
    if (r && r.state !== 'inactive') r.stop()
  }, [])

  useEffect(() => { if (rs === 'recording' && elapsed >= maxSec) stop() }, [rs, elapsed, maxSec, stop])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => () => {
    const r = recRef.current
    if (r && r.state !== 'inactive') { r.onstop = null; r.stop() }
  }, [])

  // Recording/upload cholar somoy tab bondho korte gele warning
  useEffect(() => {
    if (rs === 'idle' && !uploading) return
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [rs, uploading])

  const start = () => {
    setErr('')
    setSilent(false)
    if (typeof MediaRecorder === 'undefined') {
      return setErr('This browser cannot record. Please use a recent Chrome, Edge, Firefox or Safari.')
    }
    chunks.current = []
    const mime = pickMime(mode)
    let rec
    try {
      rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        audioBitsPerSecond: 64000,
        ...(mode === 'video' ? { videoBitsPerSecond: 1000000 } : {}), // chhoto file, Whisper limit-er niche
      })
    } catch {
      return setErr('Recording could not start in this browser.')
    }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.current.push(e.data) }
    rec.onstop = () => {
      const type = rec.mimeType || mime || (mode === 'video' ? 'video/webm' : 'audio/webm')
      const b = new Blob(chunks.current, { type })
      if (b.size === 0) { setErr('Nothing was recorded. Please try again.'); setRs('idle'); return }
      setBlob(b)
      setUrl(URL.createObjectURL(b))
      setRs('recorded')
    }
    rec.start(1000)
    recRef.current = rec
    setElapsed(0)
    setRs('recording')
  }

  const pause = () => { recRef.current?.pause(); setRs('paused') }
  const resume = () => { recRef.current?.resume(); setRs('recording') }
  const discard = () => { setBlob(null); setUrl(''); setElapsed(0); setErr(''); setRs('idle') }

  const upload = async () => {
    setErr('')
    setUploading(true)
    const t = blob.type || ''
    const ext = t.includes('mp4') ? 'mp4' : t.includes('ogg') ? 'ogg' : 'webm'
    const body = new FormData()
    body.append('file', new File([blob], `answer.${ext}`, { type: t }))
    body.append('duration_seconds', String(Math.min(elapsed, 600)))
    try {
      const { data } = await api.candidate.post(
        `/api/interviews/${applicationId}/questions/${question.id}/answer`, body, { timeout: 180000 },
      )
      if (data.no_speech) {
        setSilent(true) // kichu shona jay ni: abar record korte bolbo
        discard()
        setSilent(true)
      } else {
        onDone(question.id)
      }
    } catch (e) {
      // blob state-e ache, tai candidate shudhu "Upload" abar chapte pare
      setErr(`${errorMessage(e)} Your recording is kept. Tap "Upload answer" to try again.`)
    } finally {
      setUploading(false)
    }
  }

  const skip = async () => {
    if (!window.confirm('Skip this question? It will be scored 0.')) return
    setErr('')
    try {
      await api.candidate.post(`/api/interviews/${applicationId}/questions/${question.id}/skip`)
      onDone(question.id)
    } catch (e) {
      setErr(errorMessage(e))
    }
  }

  const recording = rs === 'recording' || rs === 'paused'
  return (
    <section className="card">
      <div className="badges" style={{ marginBottom: 8 }}>
        <span className="badge">Question {index + 1} of {total}</span>
        {question.kind === 'followup' && <span className="badge badge-warn">Follow-up</span>}
      </div>
      <p className="q-text">{question.text}</p>
      <p className="muted">Answer out loud. You have up to {maxSec} seconds. You can record again before you upload.</p>

      {mode === 'video' ? (
        <div className="video-box">
          {rs === 'recorded'
            ? <video src={url} controls playsInline aria-label="Your recorded answer" />
            : <LiveVideo stream={stream} />}
        </div>
      ) : (
        <div className="audio-box">
          {rs === 'recorded' ? <audio src={url} controls aria-label="Your recorded answer" /> : <MicMeter stream={stream} />}
        </div>
      )}

      <div className="rec-row" role="status" aria-live="polite">
        {rs === 'recording' && <span className="rec-dot" aria-hidden="true" />}
        <strong>
          {rs === 'idle' && 'Ready'}
          {rs === 'recording' && 'Recording'}
          {rs === 'paused' && 'Paused'}
          {rs === 'recorded' && 'Recorded'}
        </strong>
        <span className="muted">{fmt(elapsed)} / {fmt(maxSec)}</span>
      </div>

      {silent && (
        <Alert type="info">
          We could not hear any speech in that recording. Check your microphone and record again.
          {' '}<button type="button" className="link-btn" onClick={() => onDone(question.id)}>Continue anyway</button>
        </Alert>
      )}
      <Alert>{err}</Alert>
      {rs === 'recorded' && elapsed < MIN_SECONDS && <Alert type="info">That recording is very short. Please record again.</Alert>}

      <div className="row-actions">
        {rs === 'idle' && <button className="btn btn-primary" onClick={start}>Start recording</button>}
        {rs === 'recording' && canPause && <button className="btn btn-ghost" onClick={pause}>Pause</button>}
        {rs === 'paused' && <button className="btn btn-ghost" onClick={resume}>Resume</button>}
        {recording && <button className="btn btn-danger" onClick={stop}>Stop</button>}
        {rs === 'recorded' && (
          <>
            <button className="btn btn-primary" onClick={upload} disabled={uploading || elapsed < MIN_SECONDS}>
              {uploading ? 'Uploading and transcribing...' : 'Upload answer'}
            </button>
            <button className="btn btn-ghost" onClick={discard} disabled={uploading}>Record again</button>
          </>
        )}
        {rs === 'idle' && <button className="btn btn-ghost" onClick={skip}>Skip question</button>}
      </div>
    </section>
  )
}

