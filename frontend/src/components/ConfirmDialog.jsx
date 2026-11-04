// window.confirm-er bodole sundor, accessible dialog. Native <dialog> use kore:
// Esc diye bondho hoy, keyboard focus dialog-er bhitor thake.
import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onCancel() }} aria-labelledby="dlg-title">
      <h2 id="dlg-title">{title}</h2>
      <p className="muted">{message}</p>
      <div className="row-actions">
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        <button className="btn btn-ghost" onClick={onCancel} autoFocus>Cancel</button>
      </div>
    </dialog>
  )
}
