import { useState } from 'react'
import CvMatch from './CvMatch'
import RecommendChat from './RecommendChat'

export default function Recommend() {
  const [tab, setTab] = useState('chat')
  return (
    <div className="container section">
      <span className="eyebrow">Job finder</span>
      <h1 style={{ marginTop: 10 }}>Find jobs that fit you</h1>
      <p className="muted">Describe the job you want, or let us match your CV with open vacancies. Private to you.</p>
      <div className="tabs" role="tablist" aria-label="Job finder">
        {[['chat', 'Chat search'], ['cv', 'My CV match']].map(([k, l]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'chat' ? <RecommendChat /> : <CvMatch />}
    </div>
  )
}
