// Email-er link (/interview/<token>) ekhane ashe. Token check kore asol page-e pathai.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Alert from '../../components/Alert'
import Spinner from '../../components/Spinner'
import { api, errorMessage } from '../../services/api'

export default function InterviewEntry() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    api.candidate
      .post('/api/interviews/open', { token })
      .then(({ data }) => navigate(`/interview/start/${data.application_id}`, { replace: true }))
      .catch((e) => setError(errorMessage(e)))
  }, [token, navigate])

  if (!error) return <Spinner label="Opening interview" />
  return (
    <div className="container section">
      <div className="card narrow">
        <h1>Interview link problem</h1>
        <Alert>{error}</Alert>
        <Link to="/dashboard" className="btn btn-primary">Go to dashboard</Link>
      </div>
    </div>
  )
}
