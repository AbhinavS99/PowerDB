import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportService } from '@/services/reportService';
import './NewReportPage.css';

/**
 * Multi-step wizard for creating a new report.
 *
 * Currently Step 1 only (report metadata).
 * Additional steps will be added once the power audit data model is defined.
 */

export default function NewReportPage() {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const totalSteps = 3; // Will expand as data model is defined

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }

    // Final step — create the report
    setError('');
    setLoading(true);
    try {
      await reportService.create({ title, notes: notes || undefined });
      navigate('/dashboard');
    } catch {
      setError('Failed to create report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-report">
      <header className="new-report-header">
        <button className="btn-back" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <h1>Generate New Report</h1>
      </header>

      <main className="new-report-content">
        {/* Step indicator */}
        <div className="step-indicator">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`step ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'completed' : ''}`}
            >
              <span className="step-number">{i + 1}</span>
              <span className="step-label">
                {i === 0 ? 'Basic Info' : i === 1 ? 'Audit Data' : 'Review'}
              </span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="step-content">
              <h2>Step 1: Basic Information</h2>
              <div className="form-group">
                <label htmlFor="title">Report Title</label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="e.g. Building A - March 2026 Audit"
                />
              </div>
              <div className="form-group">
                <label htmlFor="notes">Notes (optional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any preliminary notes..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Step 2: Audit Data — placeholder */}
          {step === 2 && (
            <div className="step-content">
              <h2>Step 2: Audit Data</h2>
              <p className="placeholder-text">
                Power audit fields will be added here once the data model is defined.
                (Voltage, current, power factor, site info, equipment, etc.)
              </p>
            </div>
          )}

          {/* Step 3: Review — placeholder */}
          {step === 3 && (
            <div className="step-content">
              <h2>Step 3: Review & Submit</h2>
              <div className="review-summary">
                <p><strong>Title:</strong> {title}</p>
                <p><strong>Notes:</strong> {notes || '—'}</p>
              </div>
            </div>
          )}

          <div className="form-actions">
            {step > 1 && (
              <button type="button" className="btn-secondary" onClick={() => setStep(step - 1)}>
                ← Previous
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={loading}>
              {step < totalSteps
                ? 'Next →'
                : loading
                  ? 'Creating...'
                  : 'Create Report'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
