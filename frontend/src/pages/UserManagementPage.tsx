import { useState, useEffect, type FormEvent } from 'react';
import { API_URL } from '../App';
import './UserManagementPage.css';

interface User {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface UserManagementPageProps {
  onBack: () => void;
}

export default function UserManagementPage({ onBack }: UserManagementPageProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{ userId: number; userName: string } | null>(null);
  const [editModal, setEditModal] = useState<User | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/users`, { headers });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data);
    } catch {
      showMessage('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDelete = async (userId: number, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${userName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/users/${userId}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to delete user');
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      showMessage(`User "${userName}" deleted`, 'success');
    } catch (err: any) {
      showMessage(err.message, 'error');
    }
  };

  const handlePasswordUpdate = async (userId: number, newPassword: string) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/users/${userId}/password`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ new_password: newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update password');
      }
      showMessage('Password updated successfully', 'success');
      setPasswordModal(null);
    } catch (err: any) {
      showMessage(err.message, 'error');
    }
  };

  return (
    <div className="user-mgmt">
      <header className="user-mgmt-header">
        <div>
          <button className="btn-back" onClick={onBack}>← Back to Dashboard</button>
          <h1>User Management</h1>
        </div>
        <button className="btn-primary" onClick={() => setShowAddForm(true)}>
          + Add User
        </button>
      </header>

      <main className="user-mgmt-content">
        {message && (
          <div className={`message message-${message.type}`}>{message.text}</div>
        )}

        {showAddForm && (
          <AddUserForm
            headers={headers}
            onSuccess={(user) => {
              setUsers(prev => [user, ...prev]);
              setShowAddForm(false);
              showMessage(`User "${user.full_name}" created`, 'success');
            }}
            onCancel={() => setShowAddForm(false)}
            onError={(msg) => showMessage(msg, 'error')}
          />
        )}

        {loading ? (
          <p className="loading-text">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="empty-text">No users found.</p>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                  <td>{u.is_active ? '✓ Active' : '✗ Inactive'}</td>
                  <td>{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="actions-cell">
                    <button
                      className="btn-action btn-edit"
                      onClick={() => setEditModal(u)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-action btn-password"
                      onClick={() => setPasswordModal({ userId: u.id, userName: u.full_name })}
                    >
                      Reset Password
                    </button>
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDelete(u.id, u.full_name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {passwordModal && (
          <PasswordModal
            userName={passwordModal.userName}
            onSubmit={(pwd) => handlePasswordUpdate(passwordModal.userId, pwd)}
            onCancel={() => setPasswordModal(null)}
          />
        )}

        {editModal && (
          <EditUserModal
            user={editModal}
            headers={headers}
            onSuccess={(updated) => {
              setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, ...updated } : u));
              setEditModal(null);
              showMessage('User updated', 'success');
            }}
            onCancel={() => setEditModal(null)}
            onError={(msg) => showMessage(msg, 'error')}
          />
        )}
      </main>
    </div>
  );
}


// ---------- Add User Form ----------

function AddUserForm({
  headers,
  onSuccess,
  onCancel,
  onError,
}: {
  headers: Record<string, string>;
  onSuccess: (user: User) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('auditor');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Full name is required';
    else if (fullName.trim().length < 2) errors.fullName = 'Name must be at least 2 characters';
    if (!email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Invalid email format';
    if (phone && !/^[+]?[\d\s-]{7,15}$/.test(phone)) errors.phone = 'Invalid phone number';
    if (!password) errors.password = 'Password is required';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(password)) errors.password = 'Password must contain an uppercase letter';
    else if (!/[0-9]/.test(password)) errors.password = 'Password must contain a number';
    else if (!/[!@#$%^&*]/.test(password)) errors.password = 'Password must contain a special character (!@#$%^&*)';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role,
          password,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create user');
      }
      const user = await res.json();
      onSuccess(user);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="add-user-form">
      <h3>Add New User</h3>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-group">
            <label>Full Name *</label>
            <input value={fullName} onChange={e => { setFullName(e.target.value); setFormErrors(p => ({...p, fullName: ''})); }} placeholder="John Doe" className={formErrors.fullName ? 'input-error' : ''} />
            {formErrors.fullName && <span className="field-error">{formErrors.fullName}</span>}
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setFormErrors(p => ({...p, email: ''})); }} placeholder="john@example.com" className={formErrors.email ? 'input-error' : ''} />
            {formErrors.email && <span className="field-error">{formErrors.email}</span>}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Phone</label>
            <input value={phone} onChange={e => { setPhone(e.target.value); setFormErrors(p => ({...p, phone: ''})); }} placeholder="+91 1234567890" className={formErrors.phone ? 'input-error' : ''} />
            {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
          </div>
          <div className="form-group">
            <label>Role *</label>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value="auditor">Auditor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Password *</label>
            <input type="password" value={password} onChange={e => { setPassword(e.target.value); setFormErrors(p => ({...p, password: ''})); }} placeholder="Min 8 chars, uppercase, number, special" className={formErrors.password ? 'input-error' : ''} />
            {formErrors.password && <span className="field-error">{formErrors.password}</span>}
          </div>
          <div className="form-group form-actions-inline">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </form>
    </div>
  );
}


// ---------- Password Reset Modal ----------

function PasswordModal({
  userName,
  onSubmit,
  onCancel,
}: {
  userName: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain an uppercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError('Password must contain a number');
      return;
    }
    if (!/[!@#$%^&*]/.test(password)) {
      setError('Password must contain a special character (!@#$%^&*)');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    onSubmit(password);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h3>Reset Password for {userName}</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              required
              minLength={8}
              placeholder="Min 8 characters"
            />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              required
              placeholder="Re-enter password"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary">Update Password</button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ---------- Edit User Modal ----------

function EditUserModal({
  user,
  headers,
  onSuccess,
  onCancel,
  onError,
}: {
  user: User;
  headers: Record<string, string>;
  onSuccess: (updated: { id: number; full_name: string; email: string; phone: string | null; role: string }) => void;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || '');
  const [role, setRole] = useState(user.role);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Name is required'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/users/${user.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          role: user.role === 'super' ? undefined : role,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update user');
      }
      onSuccess({ id: user.id, full_name: fullName.trim(), email: email.trim(), phone: phone.trim() || null, role: user.role === 'super' ? user.role : role });
    } catch (err: any) {
      setError(err.message);
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <h3>Edit User — {user.full_name}</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 1234567890" />
          </div>
          {user.role !== 'super' && (
            <div className="form-group">
              <label>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="auditor">Auditor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
