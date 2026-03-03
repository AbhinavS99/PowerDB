import { useEffect, useState } from 'react'
import './index.css'

const API_URL = import.meta.env.VITE_API_URL || ''

function App() {
  const [message, setMessage] = useState('Loading...')
  const [health, setHealth] = useState('checking...')

  useEffect(() => {
    fetch(`${API_URL}/api/hello`)
      .then(res => res.json())
      .then(data => setMessage(data.message))
      .catch(() => setMessage('Failed to connect to backend'))

    fetch(`${API_URL}/api/health`)
      .then(res => res.json())
      .then(data => setHealth(data.status))
      .catch(() => setHealth('unreachable'))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1 style={{ color: '#1677ff', marginBottom: '1rem' }}>PowerDB</h1>
      <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{message}</p>
      <p style={{ color: '#888' }}>Backend status: <strong>{health}</strong></p>
      <p style={{ color: '#aaa', marginTop: '2rem', fontSize: '0.85rem' }}>
        API: {API_URL || '(proxied)'}
      </p>
    </div>
  )
}

export default App
