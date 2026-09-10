import React, { useState, useEffect } from 'react';
import type { LoyaltyProgramBalance, LoyaltyProgramType } from '@payments-optimizer/domain';
import { getLoyaltyRepository } from '@payments-optimizer/storage';

interface LoyaltyProgramsProps {
  profile: import('@payments-optimizer/domain').UserProfile;
}

const PROGRAM_TYPE_LABELS: Record<LoyaltyProgramType, string> = {
  airline: '✈️ Airline',
  hotel: '🏨 Hotel',
  retail: '🛍️ Retail',
  other: '📋 Other',
};

const PROGRAM_TYPE_COLORS: Record<LoyaltyProgramType, string> = {
  airline: '#1e40af',
  hotel: '#92400e',
  retail: '#7c2d12',
  other: '#374151',
};

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function daysUntilExpiry(expiryDate: number): number {
  const diffMs = expiryDate - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function getExpiryStatus(expiryDate?: number): {
  status: 'expired' | 'expiring_soon' | 'active' | 'none';
  daysLeft?: number;
  label: string;
  color: string;
} {
  if (!expiryDate) {
    return { status: 'none', label: 'No expiry set', color: 'var(--text-muted)' };
  }
  const daysLeft = daysUntilExpiry(expiryDate);
  if (daysLeft < 0) {
    return { status: 'expired', daysLeft, label: `Expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`, color: '#dc2626' };
  }
  if (daysLeft <= 7) {
    return { status: 'expiring_soon', daysLeft, label: `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`, color: '#ea580c' };
  }
  return { status: 'active', daysLeft, label: `${daysLeft} days left`, color: '#16a34a' };
}

function calculateEstimatedValue(balance: LoyaltyProgramBalance): string | null {
  if (balance.userEstimatedValuePerUnitMinor === undefined) return null;
  const valueMinor = Math.round(balance.balance * Number(balance.userEstimatedValuePerUnitMinor));
  const currency = 'INR'; // default display currency
  const major = valueMinor / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(major);
}

function LoyaltyProgramRow({
  balance,
  onEdit,
  onDelete,
}: {
  balance: LoyaltyProgramBalance;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const expiry = getExpiryStatus(balance.expiryDate);
  const estimatedValue = calculateEstimatedValue(balance);
  const typeLabel = PROGRAM_TYPE_LABELS[balance.programType];
  const typeColor = PROGRAM_TYPE_COLORS[balance.programType];

  return (
    <div
      className="loyalty-row"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: '12px',
        alignItems: 'center',
        padding: '12px',
        background: 'var(--bg-tertiary)',
        borderRadius: '8px',
        borderLeft: `4px solid ${typeColor}`,
        marginBottom: '8px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: typeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '16px',
        }}
      >
        {typeLabel.charAt(0)}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: '13px',
              color: 'var(--text-primary)',
            }}
          >
            {balance.programName}
          </span>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {typeLabel}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)' }}>
          <span>💰 Balance: <strong>{balance.balance.toLocaleString()}</strong> pts</span>
          {expiry.status !== 'none' && (
            <span
              style={{
                color: expiry.color,
                fontWeight: expiry.status === 'expiring_soon' || expiry.status === 'expired' ? 600 : 400,
              }}
            >
              {expiry.label}
            </span>
          )}
          {estimatedValue && (
            <span style={{ color: 'var(--brand-primary)', fontWeight: 500 }}>
              ≈ {estimatedValue} (est.)
            </span>
          )}
        </div>

        <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
          Last updated {formatRelativeTime(balance.lastUpdatedTimestamp)} ({formatDate(balance.lastUpdatedTimestamp)})
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px' }}
          onClick={onEdit}
          aria-label={`Edit ${balance.programName}`}
        >
          Edit
        </button>
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '11px', color: '#dc2626', borderColor: '#dc2626' }}
          onClick={onDelete}
          aria-label={`Delete ${balance.programName}`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

interface LoyaltyProgramFormProps {
  initialData?: LoyaltyProgramBalance | null;
  onSubmit: (data: Omit<LoyaltyProgramBalance, 'id' | 'lastUpdatedTimestamp'>) => void;
  onCancel: () => void;
}

function LoyaltyProgramForm({ initialData, onSubmit, onCancel }: LoyaltyProgramFormProps) {
  const [programName, setProgramName] = useState(initialData?.programName || '');
  const [programType, setProgramType] = useState<LoyaltyProgramType>(initialData?.programType || 'other');
  const [balance, setBalance] = useState(initialData?.balance?.toString() || '');
  const [userEstimatedValuePerUnitMinor, setUserEstimatedValuePerUnitMinor] = useState(
    initialData?.userEstimatedValuePerUnitMinor?.toString() || ''
  );
  const [expiryDate, setExpiryDate] = useState(
    initialData?.expiryDate ? new Date(initialData.expiryDate).toISOString().split('T')[0] : ''
  );
  const [expiryPolicyNote, setExpiryPolicyNote] = useState(initialData?.expiryPolicyNote || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!programName.trim()) newErrors.programName = 'Program name is required';
    if (!balance || parseFloat(balance) < 0) newErrors.balance = 'Valid balance required';
    if (userEstimatedValuePerUnitMinor && parseFloat(userEstimatedValuePerUnitMinor) < 0) {
      newErrors.userEstimatedValuePerUnitMinor = 'Value must be positive';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: Omit<LoyaltyProgramBalance, 'id' | 'lastUpdatedTimestamp'> = {
      programName: programName.trim(),
      programType,
      balance: parseFloat(balance),
    };
    if (userEstimatedValuePerUnitMinor) {
      data.userEstimatedValuePerUnitMinor = BigInt(Math.round(parseFloat(userEstimatedValuePerUnitMinor) * 100));
    }
    if (expiryDate) {
      data.expiryDate = new Date(expiryDate).getTime();
    }
    if (expiryPolicyNote.trim()) {
      data.expiryPolicyNote = expiryPolicyNote.trim();
    }
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
          Program Name *
        </label>
        <input
          type="text"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
          placeholder="e.g., Air India Flying Returns, Marriott Bonvoy"
          style={{ width: '100%', padding: '10px', fontSize: '13px', boxSizing: 'border-box' }}
          aria-invalid={!!errors.programName}
        />
        {errors.programName && <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px' }}>{errors.programName}</p>}
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
          Program Type *
        </label>
        <select
          value={programType}
          onChange={(e) => setProgramType(e.target.value as LoyaltyProgramType)}
          style={{ width: '100%', padding: '10px', fontSize: '13px', boxSizing: 'border-box' }}
        >
          <option value="airline">✈️ Airline</option>
          <option value="hotel">🏨 Hotel</option>
          <option value="retail">🛍️ Retail</option>
          <option value="other">📋 Other</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
          Current Balance *
        </label>
        <input
          type="number"
          min="0"
          step="1"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          placeholder="e.g., 45000"
          style={{ width: '100%', padding: '10px', fontSize: '13px', boxSizing: 'border-box' }}
          aria-invalid={!!errors.balance}
        />
        {errors.balance && <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px' }}>{errors.balance}</p>}
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
          Estimated Value per Point (optional)
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={userEstimatedValuePerUnitMinor}
            onChange={(e) => setUserEstimatedValuePerUnitMinor(e.target.value)}
            placeholder="e.g., 0.50"
            style={{ flex: 1, padding: '10px', fontSize: '13px', boxSizing: 'border-box' }}
            aria-invalid={!!errors.userEstimatedValuePerUnitMinor}
          />
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
            ₹/point
          </span>
        </div>
        {errors.userEstimatedValuePerUnitMinor && (
          <p style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px' }}>{errors.userEstimatedValuePerUnitMinor}</p>
        )}
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
          Expiry Date (optional)
        </label>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          style={{ width: '100%', padding: '10px', fontSize: '13px', boxSizing: 'border-box' }}
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
          Expiry Policy Note (optional)
        </label>
        <textarea
          value={expiryPolicyNote}
          onChange={(e) => setExpiryPolicyNote(e.target.value)}
          placeholder="e.g., Expires 18 months after last activity"
          rows={2}
          style={{ width: '100%', padding: '10px', fontSize: '13px', boxSizing: 'border-box', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!programName.trim() || !balance}>
          {initialData ? 'Save Changes' : 'Add Program'}
        </button>
      </div>
    </form>
  );
}

export default function LoyaltyPrograms({ profile }: LoyaltyProgramsProps) {
  const [balances, setBalances] = useState<LoyaltyProgramBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBalance, setEditingBalance] = useState<LoyaltyProgramBalance | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadBalances() {
      try {
        const repo = getLoyaltyRepository();
        const data = await repo.getAll();
        setBalances(data.sort((a, b) => b.lastUpdatedTimestamp - a.lastUpdatedTimestamp));
      } catch (err) {
        console.error('[PaymentsOptimizer] Failed to load loyalty balances:', err);
      } finally {
        setLoading(false);
      }
    }
    loadBalances();
  }, []);

  const handleAdd = () => {
    setEditingBalance(null);
    setShowForm(true);
  };

  const handleEdit = (balance: LoyaltyProgramBalance) => {
    setEditingBalance(balance);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBalance(null);
  };

  const handleSubmit = async (data: Omit<LoyaltyProgramBalance, 'id' | 'lastUpdatedTimestamp'>) => {
    try {
      const repo = getLoyaltyRepository();
      const now = Date.now();

      if (editingBalance) {
        const updatedBalance: LoyaltyProgramBalance = {
          ...editingBalance,
          programName: data.programName,
          programType: data.programType,
          balance: data.balance,
          lastUpdatedTimestamp: now,
        };
        if (data.userEstimatedValuePerUnitMinor !== undefined) {
          updatedBalance.userEstimatedValuePerUnitMinor = data.userEstimatedValuePerUnitMinor;
        } else {
          delete updatedBalance.userEstimatedValuePerUnitMinor;
        }
        if (data.expiryDate !== undefined) {
          updatedBalance.expiryDate = data.expiryDate;
        } else {
          delete updatedBalance.expiryDate;
        }
        if (data.expiryPolicyNote !== undefined) {
          updatedBalance.expiryPolicyNote = data.expiryPolicyNote;
        } else {
          delete updatedBalance.expiryPolicyNote;
        }
        await repo.update(updatedBalance);
        setStatusMessage('Loyalty program updated');
      } else {
        const newBalance: LoyaltyProgramBalance = {
          programName: data.programName,
          programType: data.programType,
          balance: data.balance,
          id: crypto.randomUUID(),
          lastUpdatedTimestamp: now,
        };
        if (data.userEstimatedValuePerUnitMinor !== undefined) {
          newBalance.userEstimatedValuePerUnitMinor = data.userEstimatedValuePerUnitMinor;
        }
        if (data.expiryDate !== undefined) {
          newBalance.expiryDate = data.expiryDate;
        }
        if (data.expiryPolicyNote !== undefined) {
          newBalance.expiryPolicyNote = data.expiryPolicyNote;
        }
        await repo.add(newBalance);
        setStatusMessage('Loyalty program added');
      }
      setShowForm(false);
      setEditingBalance(null);
      const updated = await repo.getAll();
      setBalances(updated.sort((a, b) => b.lastUpdatedTimestamp - a.lastUpdatedTimestamp));
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('[PaymentsOptimizer] Failed to save loyalty program:', err);
      setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this loyalty program? This cannot be undone.')) return;
    try {
      const repo = getLoyaltyRepository();
      await repo.delete(id);
      setBalances((prev) => prev.filter((b) => b.id !== id));
      setStatusMessage('Loyalty program deleted');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error('[PaymentsOptimizer] Failed to delete loyalty program:', err);
      setStatusMessage(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="slide-in" style={{ textAlign: 'center', padding: '32px' }}>
        <div className="diagnostics-spinner" style={{ margin: '0 auto 16px' }}></div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Loading loyalty programs...</p>
      </div>
    );
  }

  return (
    <div className="slide-in">
      <div
        className="glass-panel"
        style={{
          padding: '16px',
          marginBottom: '16px',
          borderLeft: '4px solid var(--brand-primary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <h2 className="section-title" style={{ fontSize: '16px', marginBottom: '4px' }}>
              🎁 Loyalty Programs
            </h2>
            <p className="section-desc" style={{ marginBottom: '0', fontSize: '12px' }}>
              Track points/miles balances across airline, hotel, retail, and other programs.
            </p>
          </div>
          <button className="btn btn-primary" onClick={handleAdd} style={{ padding: '8px 16px', fontSize: '12px' }}>
            + Add Program
          </button>
        </div>
        <p className="section-desc" style={{ marginBottom: '0', fontSize: '11px', marginTop: '8px' }}>
          Balances are stored locally only. Add expiry dates to get reminders before points expire.
        </p>
      </div>

      {showForm && (
        <div className="slide-in">
          <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ fontSize: '16px', marginBottom: '16px' }}>
              {editingBalance ? 'Edit Loyalty Program' : 'Add Loyalty Program'}
            </h3>
            <LoyaltyProgramForm
              initialData={editingBalance}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </div>
        </div>
      )}

      {statusMessage && (
        <div
          className="slide-in"
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          {statusMessage}
        </div>
      )}

      {balances.length === 0 && !showForm && (
        <div className="slide-in">
          <div
            className="glass-panel"
            style={{
              padding: '32px',
              textAlign: 'center',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎁</div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
              No Loyalty Programs Yet
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Add your airline miles, hotel points, retail rewards, or other loyalty balances to track
              them and get expiry reminders.
            </p>
            <button className="btn btn-primary" onClick={handleAdd} style={{ width: '100%' }}>
              Add Your First Program
            </button>
          </div>
        </div>
      )}

      {balances.length > 0 && !showForm && (
        <div className="slide-in" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {balances.map((balance) => (
            <LoyaltyProgramRow
              key={balance.id}
              balance={balance}
              onEdit={() => handleEdit(balance)}
              onDelete={() => handleDelete(balance.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { LoyaltyPrograms };