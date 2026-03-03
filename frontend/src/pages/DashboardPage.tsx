import './DashboardPage.css';

interface DashboardPageProps {
  user: {
    id: number;
    full_name: string;
    email: string;
    phone: string | null;
    role: string;
  };
  onLogout: () => void;
  onManageUsers?: () => void;
}

export default function DashboardPage({ user, onLogout, onManageUsers }: DashboardPageProps) {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>PowerDB</h1>
        <div className="header-actions">
          {onManageUsers && (
            <button className="btn-primary" onClick={onManageUsers}>
              Manage Users
            </button>
          )}
          <span className="user-info">{user.full_name} ({user.role})</span>
          <button className="btn-secondary" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <h2>Welcome, {user.full_name}!</h2>
        <div className="user-card">
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Phone:</strong> {user.phone || '—'}</p>
          <p><strong>Role:</strong> {user.role}</p>
        </div>
        <p className="placeholder-text">
          Dashboard content coming soon — reports, data logging, and more.
        </p>
      </main>
    </div>
  );
}
