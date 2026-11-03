import { Link } from 'react-router-dom'
import EmptyState from '../components/EmptyState'

export default function NotFound() {
  return (
    <div className="container section">
      <EmptyState title="Page not found" text="The page you are looking for does not exist yet.">
        <Link to="/" className="btn btn-primary">Back to home</Link>
      </EmptyState>
    </div>
  )
}
