export default function EmptyState({ title, text, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {children}
    </div>
  )
}
