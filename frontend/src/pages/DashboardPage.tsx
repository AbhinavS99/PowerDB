import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { reportService } from '@/services/reportService';
import type { Report } from '@/types';
import './DashboardPage.css';

export default function DashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await reportService.list();
      setReports(data);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this report?')) return;
    try {
      await reportService.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Failed to delete report', err);
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      draft: 'Draft',
      in_progress: 'In Progress',
      completed: 'Completed',
    };
    return map[status] || status;
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>PowerDB</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => navigate('/reports/new')}>
            + Generate New Report
          </button>
          <button className="btn-secondary" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="dashboard-content">
        <h2>Your Reports</h2>

        {loading ? (
          <p className="loading">Loading reports...</p>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <p>No reports yet. Click "Generate New Report" to get started.</p>
          </div>
        ) : (
          <table className="reports-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.title}</td>
                  <td>
                    <span className={`status-badge status-${report.status}`}>
                      {statusLabel(report.status)}
                    </span>
                  </td>
                  <td>{new Date(report.created_at).toLocaleDateString()}</td>
                  <td>{new Date(report.updated_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn-link"
                      onClick={() => handleDelete(report.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
