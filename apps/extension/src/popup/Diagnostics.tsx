import React, { useState } from 'react';
import type { UserProfile } from '@payments-optimizer/domain';
import { ProfileImportExport } from '@payments-optimizer/profile';

interface DiagnosticsProps {
  profile: UserProfile;
  activeTabId: number | null;
  onUpdateProfile: (profile: UserProfile) => void;
}

export default function Diagnostics({ profile, activeTabId, onUpdateProfile }: DiagnosticsProps) {
  const [passphrase, setPassphrase] = useState('');
  const [dataArea, setDataArea] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const exported = await ProfileImportExport.exportProfile(profile, passphrase || undefined);
      setDataArea(exported);
      setStatusMessage('Profile exported successfully! Copy the text below.');
    } catch (err) {
      setStatusMessage(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImport = async () => {
    if (!dataArea.trim()) {
      setStatusMessage('Please paste the exported profile data first.');
      return;
    }
    try {
      const importedProfile = await ProfileImportExport.importProfile(dataArea, passphrase || undefined);
      onUpdateProfile(importedProfile);
      setStatusMessage('Profile imported successfully!');
    } catch (err) {
      setStatusMessage(`Import failed: Check data or passphrase. ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset your local database? All cards will be deleted.')) {
      try {
        await chrome.storage.local.clear();
        await chrome.storage.session.clear();
        window.location.reload();
      } catch (err) {
        setStatusMessage(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  return (
    <div className="slide-in" style={{ fontSize: '12px' }}>
      <h2 className="section-title" style={{ fontSize: '15px', marginBottom: '8px' }}>System Diagnostics</h2>
      
      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
          <span>Database Engine</span>
          <span style={{ color: 'var(--text-primary)' }}>IndexedDB + Chrome Storage</span>
        </div>
        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
          <span>Security Layer</span>
          <span style={{ color: 'var(--text-primary)' }}>AES-GCM PBKDF2 (Native)</span>
        </div>
        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
          <span>Schema Version</span>
          <span style={{ color: 'var(--text-primary)' }}>v{profile.version}</span>
        </div>
        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
          <span>Active Tab ID</span>
          <span style={{ color: 'var(--text-primary)' }}>{activeTabId ?? 'None'}</span>
        </div>
      </div>

      <h2 className="section-title" style={{ fontSize: '15px', marginBottom: '8px' }}>Vault Import / Export</h2>
      
      <div className="form-group" style={{ marginBottom: '10px' }}>
        <label className="form-label">Vault Passphrase (Optional for Encryption)</label>
        <input
          type="password"
          className="form-input"
          style={{ padding: '6px 10px', fontSize: '12px' }}
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Leave blank for unencrypted JSON"
        />
      </div>

      <div className="form-group" style={{ marginBottom: '12px' }}>
        <label className="form-label">Data Area</label>
        <textarea
          className="form-input"
          style={{ height: '80px', fontFamily: 'monospace', fontSize: '10px', resize: 'none' }}
          value={dataArea}
          onChange={(e) => setDataArea(e.target.value)}
          placeholder="Paste backup text here for import or copy from here after export"
        />
      </div>

      {statusMessage && (
        <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', marginBottom: '12px', fontSize: '11px', color: 'var(--brand-primary)' }}>
          {statusMessage}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handleExport}>
          Export Profile
        </button>
        <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={handleImport}>
          Import Profile
        </button>
      </div>

      <button className="btn btn-secondary" style={{ width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleReset}>
        Reset Storage
      </button>
    </div>
  );
}
