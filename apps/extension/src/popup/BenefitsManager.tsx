import React, { useState } from 'react';
import type { UserProfile, UserMembership, UserVoucher } from '@payments-optimizer/domain';
import { PublicBenefitCatalog, VoucherInventoryManager } from '@payments-optimizer/benefits';

interface BenefitsManagerProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
}

export default function BenefitsManager({ profile, onUpdateProfile }: BenefitsManagerProps) {
  const catalog = new PublicBenefitCatalog();
  const availablePrograms = catalog.getAllPrograms();

  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'MEMBERSHIPS' | 'VOUCHERS'>(
    'OVERVIEW'
  );

  // Form states for adding voucher
  const [showAddVoucher, setShowAddVoucher] = useState(false);
  const [voucherMerchant, setVoucherMerchant] = useState('myntra');
  const [voucherTitle, setVoucherTitle] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherValue, setVoucherValue] = useState('500');
  const [voucherExpiryDays, setVoucherExpiryDays] = useState('7');

  // Form states for adding membership
  const [showAddMembership, setShowAddMembership] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(
    availablePrograms[0]?.id || 'accor-all'
  );
  const [membershipTier, setMembershipTier] = useState('Gold');

  const memberships = profile.memberships || [];
  const vouchers = profile.vouchers || [];

  const voucherManager = new VoucherInventoryManager(vouchers);
  const expiringSoon = voucherManager.getExpiringSoon(7);

  const handleAddVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(voucherValue) || 0;
    const days = parseInt(voucherExpiryDays, 10) || 7;
    const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const newVoucher: UserVoucher = {
      id: `voucher-${Date.now()}`,
      merchantId: voucherMerchant.toLowerCase().trim(),
      title: voucherTitle.trim() || `${voucherMerchant.toUpperCase()} ₹${amountVal} Voucher`,
      code: voucherCode.trim() || undefined,
      initialValue: {
        amountMinor: BigInt(Math.round(amountVal * 100)),
        currency: profile.currency,
      },
      remainingValue: {
        amountMinor: BigInt(Math.round(amountVal * 100)),
        currency: profile.currency,
      },
      expiryDate,
      singleUse: false,
    };

    const updatedVouchers = [...vouchers, newVoucher];
    onUpdateProfile({ ...profile, vouchers: updatedVouchers });
    setShowAddVoucher(false);
    setVoucherTitle('');
    setVoucherCode('');
    setVoucherValue('500');
  };

  const handleRemoveVoucher = (id: string) => {
    const updatedVouchers = vouchers.filter((v) => v.id !== id);
    onUpdateProfile({ ...profile, vouchers: updatedVouchers });
  };

  const handleAddMembership = (e: React.FormEvent) => {
    e.preventDefault();
    const program = availablePrograms.find((p) => p.id === selectedProgramId);
    if (!program) return;

    const newMem: UserMembership = {
      id: `mem-${program.id}-${Date.now()}`,
      programId: program.id,
      programName: program.name,
      tier: membershipTier,
    };

    const filtered = memberships.filter((m) => m.programId !== program.id);
    onUpdateProfile({ ...profile, memberships: [...filtered, newMem] });
    setShowAddMembership(false);
  };

  const handleRemoveMembership = (programId: string) => {
    const updated = memberships.filter((m) => m.programId !== programId);
    onUpdateProfile({ ...profile, memberships: updated });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sub tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
        }}
      >
        <button
          className={`btn ${activeSubTab === 'OVERVIEW' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '11px', padding: '4px 10px' }}
          onClick={() => setActiveSubTab('OVERVIEW')}
        >
          WHAT DO I HAVE?
        </button>
        <button
          className={`btn ${activeSubTab === 'MEMBERSHIPS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '11px', padding: '4px 10px' }}
          onClick={() => setActiveSubTab('MEMBERSHIPS')}
        >
          MEMBERSHIPS ({memberships.length})
        </button>
        <button
          className={`btn ${activeSubTab === 'VOUCHERS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '11px', padding: '4px 10px' }}
          onClick={() => setActiveSubTab('VOUCHERS')}
        >
          VOUCHERS ({vouchers.length})
        </button>
      </div>

      {/* OVERVIEW TAB */}
      {activeSubTab === 'OVERVIEW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Expiring Soon Alert Banner */}
          {expiringSoon.length > 0 ? (
            <div
              style={{
                background:
                  'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(249, 115, 22, 0.15))',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                padding: '12px',
              }}
            >
              <div
                style={{ fontWeight: 600, color: '#f87171', fontSize: '13px', marginBottom: '6px' }}
              >
                🔥 BENEFITS EXPIRING SOON
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {expiringSoon.map(({ voucher, daysLeft }) => (
                  <div
                    key={voucher.id}
                    style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}
                  >
                    <span>🎟️ {voucher.title}</span>
                    <span style={{ fontWeight: 600, color: '#fb923c' }}>
                      ₹{Number(voucher.remainingValue.amountMinor) / 100} •{' '}
                      {daysLeft === 1 ? '1 day left' : `${daysLeft} days left`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.03)',
                padding: '10px',
                borderRadius: '6px',
              }}
            >
              ✓ No vouchers expiring within the next 7 days.
            </div>
          )}

          {/* Quick Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)' }}>
                {memberships.length}
              </div>
              <div
                style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}
              >
                Active Memberships
              </div>
            </div>

            <div className="card" style={{ padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#34d399' }}>
                ₹{vouchers.reduce((acc, v) => acc + Number(v.remainingValue.amountMinor) / 100, 0)}
              </div>
              <div
                style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}
              >
                Stored Voucher Value
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MEMBERSHIPS TAB */}
      {activeSubTab === 'MEMBERSHIPS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Connected Programs</span>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '11px' }}
              onClick={() => setShowAddMembership(!showAddMembership)}
            >
              + Add Membership
            </button>
          </div>

          {showAddMembership && (
            <form
              onSubmit={handleAddMembership}
              className="card"
              style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <label style={{ fontSize: '11px' }}>Select Program:</label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                style={{
                  padding: '6px',
                  background: 'var(--surface-color)',
                  color: 'inherit',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              >
                {availablePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </select>

              <label style={{ fontSize: '11px' }}>Tier / Status:</label>
              <input
                type="text"
                value={membershipTier}
                onChange={(e) => setMembershipTier(e.target.value)}
                style={{
                  padding: '6px',
                  background: 'var(--surface-color)',
                  color: 'inherit',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddMembership(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {memberships.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              No memberships connected yet.
            </div>
          ) : (
            memberships.map((m) => (
              <div
                key={m.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{m.programName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Tier: {m.tier || 'Member'}
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '10px', color: '#f87171' }}
                  onClick={() => handleRemoveMembership(m.programId)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* VOUCHERS TAB */}
      {activeSubTab === 'VOUCHERS' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Stored Vouchers & Coupons
            </span>
            <button
              className="btn btn-secondary"
              style={{ fontSize: '11px' }}
              onClick={() => setShowAddVoucher(!showAddVoucher)}
            >
              + Add Voucher
            </button>
          </div>

          {showAddVoucher && (
            <form
              onSubmit={handleAddVoucher}
              className="card"
              style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <label style={{ fontSize: '11px' }}>Merchant (e.g. Amazon, Myntra, Swiggy):</label>
              <input
                type="text"
                value={voucherMerchant}
                onChange={(e) => setVoucherMerchant(e.target.value)}
                required
                style={{
                  padding: '6px',
                  background: 'var(--surface-color)',
                  color: 'inherit',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              />

              <label style={{ fontSize: '11px' }}>Voucher Title / Description:</label>
              <input
                type="text"
                placeholder="₹500 Birthday Voucher"
                value={voucherTitle}
                onChange={(e) => setVoucherTitle(e.target.value)}
                style={{
                  padding: '6px',
                  background: 'var(--surface-color)',
                  color: 'inherit',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              />

              <label style={{ fontSize: '11px' }}>Coupon / Voucher Code (Optional):</label>
              <input
                type="text"
                placeholder="MYN500OFF"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                style={{
                  padding: '6px',
                  background: 'var(--surface-color)',
                  color: 'inherit',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px' }}>Value (₹):</label>
                  <input
                    type="number"
                    value={voucherValue}
                    onChange={(e) => setVoucherValue(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: 'var(--surface-color)',
                      color: 'inherit',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px' }}>Expires In (Days):</label>
                  <input
                    type="number"
                    value={voucherExpiryDays}
                    onChange={(e) => setVoucherExpiryDays(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: 'var(--surface-color)',
                      color: 'inherit',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Save Voucher
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddVoucher(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {vouchers.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              No vouchers added yet.
            </div>
          ) : (
            vouchers.map((v) => (
              <div
                key={v.id}
                className="card"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>{v.title}</div>
                  <div style={{ fontSize: '11px', color: '#34d399' }}>
                    Remaining: ₹{Number(v.remainingValue.amountMinor) / 100}
                    {v.code ? ` • Code: ${v.code}` : ''}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Expires: {new Date(v.expiryDate).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '10px', color: '#f87171' }}
                  onClick={() => handleRemoveVoucher(v.id)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
