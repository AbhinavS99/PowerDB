import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import UserManagementPage from './pages/UserManagementPage'
import ReportDetailPage from './pages/ReportDetailPage'
import './index.css'

const API_URL = import.meta.env.VITE_API_URL || ''

export { API_URL }

export interface UserInfo {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
}

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<UserInfo | null>(null)
  const [page, setPage] = useState<string>('dashboard')
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)

  useEffect(() => {
    if (token) {
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

  const handleLogin = (accessToken: string, userData: UserInfo) => {
    localStorage.setItem('token', accessToken)
    setToken(accessToken)
    setUser(userData)
    setPage('dashboard')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setPage('dashboard')
  }

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />
  }

  if (page === 'users' && user.role === 'super') {
    return <UserManagementPage onBack={() => setPage('dashboard')} />
  }

  if (page === 'report' && selectedReportId) {
    return (
      <ReportDetailPage
        reportId={selectedReportId}
        user={user}
        onBack={() => { setPage('dashboard'); setSelectedReportId(null); }}
      />
    )
  }

  return (
    <DashboardPage
      user={user}
      onLogout={handleLogout}
      onManageUsers={user.role === 'super' ? () => setPage('users') : undefined}
      onOpenReport={(id) => { setSelectedReportId(id); setPage('report'); }}
    />
  )
}

export default App
