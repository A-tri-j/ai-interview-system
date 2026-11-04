// Camera/mic permission, live preview, mic level meter.
import { useCallback, useEffect, useRef, useState } from 'react'

export function useMedia(mode) {
  const [stream, setStream] = useState(null)
  const [error, setError] = useState('')
  const [asking, setAsking] = useState(false)
  const ref = useRef(null)

  const stop = useCallback(() => {
    ref.current?.getTracks().forEach((t) => t.stop())
    ref.current = null
    setStream(null)
  }, [])

  const request = useCallback(async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser cannot access the camera or microphone. Use a recent Chrome, Edge, Firefox or Safari over HTTPS.')
      return
    }
    setAsking(true)
    try {
      stop()
      const s = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
      })
      ref.current = s
      setStream(s)
    } catch (e) {
      const name = e?.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Permission was blocked. Allow the camera and microphone in your browser site settings, then try again.')
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('No camera or microphone was found on this device.')
      } else if (name === 'NotReadableError') {
        setError('Your camera or microphone is being used by another app. Close it and try again.')
      } else {
        setError('Could not start the camera or microphone.')
      }
    } finally {
      setAsking(false)
    }
  }, [mode, stop])

  useEffect(() => stop, [stop]) // page chhere gele camera bondho
  return { stream, error, asking, request, stop }
}

export function LiveVideo({ stream }) {
  const ref = useRef(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.srcObject = stream
    if (stream) v.play?.().catch(() => {})
  }, [stream])
  return <video ref={ref} className="mirror" autoPlay muted playsInline aria-label="Camera preview" />
}

export function MicMeter({ stream }) {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    let raf
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let peak = 0
      for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
      setLevel(Math.min(1, peak / 64))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(raf)
      src.disconnect()
      ctx.close().catch(() => {})
    }
  }, [stream])

  return (
    <div className="mic" role="img" aria-label="Microphone level">
      <span className="muted">Microphone</span>
      <div className="mic-bar"><span style={{ width: `${Math.round(level * 100)}%` }} /></div>
    </div>
  )
}

