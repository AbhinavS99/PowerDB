import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import './index.css'

const API_URL = import.meta.env.VITE_API_URL || ''

export { API_URL }

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (token) {
      // Validate token by fetching current user
      fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token')
          return res.json()
        })
        .then(data => setUser(data))
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
          setUser(null)
        })
    }
  }, [token])

  const handleLogin = (accessToken: string, userData: any) => {
    localStorage.setItem('token', accessToken)
    setToken(accessToken)
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />
  }

  return <DashboardPage user={user} onLogout={handleLogout} />
}

export default App
