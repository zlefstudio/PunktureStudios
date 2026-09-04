import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useStore } from '../store';
import type { BackupPayload } from '../types';

export function BackupView() {
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);

  const fileRef                               = useRef<HTMLInputElement>(null);
  const [importError,    setImportError]    = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);
  const [importing,      setImporting]      = useState(false);
  const [success,        setSuccess]        = useState<string | null>(null);

  function handleExport() {
    const { tickets, items } = exportBackup();
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tickets,
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const now  = new Date();
    const ts   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `piercing-backup-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess(`Backup exported: piercing-backup-${ts}.json`);
    setTimeout(() => setSuccess(null), 4000);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    setPendingPayload(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw     = JSON.parse(ev.target?.result as string) as unknown;
        const payload = validatePayload(raw);
        setPendingPayload(payload);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Invalid file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function confirmImport() {
    if (!pendingPayload) return;
    setImporting(true);
    try {
      await importBackup(pendingPayload.tickets, pendingPayload.items);
      setPendingPayload(null);
      setSuccess(`Imported ${pendingPayload.tickets.length} tickets, ${pendingPayload.items.length} items.`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: '14px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    padding: '18px',
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

      {/* Export */}
      <div style={cardStyle} className="space-y-3">
        <h3 className="text-heading-sm" style={{ color: 'var(--color-text)' }}>
          Export Backup
        </h3>
        <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          Downloads all tickets and items as a JSON file. Save it somewhere safe.
        </p>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-ui font-semibold"
          style={{
            background: 'var(--color-success)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 2px 10px rgba(5,150,105,0.28)',
          }}
        >
          <Download size={15} />
          Export JSON Backup
        </button>
        {success && (
          <p
            className="text-body-xs px-3 py-2 rounded-lg"
            style={{
              color: 'var(--color-success-text)',
              background: 'var(--color-success-bg)',
              border: '1px solid rgba(5,150,105,0.25)',
            }}
          >
            {success}
          </p>
        )}
      </div>

      {/* Import */}
      <div style={cardStyle} className="space-y-3">
        <h3 className="text-heading-sm" style={{ color: 'var(--color-text)' }}>
          Import Backup
        </h3>
        <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
          Replaces ALL current data with the backup file. This cannot be undone.
        </p>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-ui font-semibold"
          style={{
            background: 'rgba(37,99,235,0.80)',
            color: '#fff',
            border: 'none',
            boxShadow: '0 2px 10px rgba(37,99,235,0.28)',
          }}
        >
          <Upload size={15} />
          Choose Backup File
        </button>
        <input ref={fileRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />

        {importError && (
          <div
            className="flex items-start gap-2 text-body-xs rounded-lg p-2.5"
            style={{
              color: 'var(--color-error-text)',
              background: 'var(--color-error-bg)',
              border: '1px solid rgba(185,28,28,0.25)',
            }}
          >
            <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '1px' }} />
            <span>{importError}</span>
          </div>
        )}

        {pendingPayload && (
          <div
            className="rounded-xl p-3 space-y-2"
            style={{
              background: 'var(--color-warn-bg)',
              border: '1px solid rgba(217,119,6,0.35)',
            }}
          >
            <p
              className="text-body-xs font-semibold flex items-center gap-1.5"
              style={{ color: 'var(--color-warn-text)' }}
            >
              <AlertTriangle size={12} />
              This will replace all current data!
            </p>
            <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
              {pendingPayload.tickets.length} tickets · {pendingPayload.items.length} items
              <br />
              Exported: {new Date(pendingPayload.exportedAt).toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 py-2 rounded-lg text-body-sm font-semibold"
                style={{
                  background: 'var(--color-warn)',
                  color: '#fff',
                  border: 'none',
                  opacity: importing ? 0.5 : 1,
                }}
              >
                {importing ? 'Importing…' : 'Yes, Replace Data'}
              </button>
              <button
                onClick={() => setPendingPayload(null)}
                className="flex-1 py-2 rounded-lg text-body-sm font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* IndexedDB warning */}
      <div
        className="rounded-xl p-4 flex gap-3"
        style={{
          background: 'var(--color-warn-bg)',
          border: '1px solid rgba(217,119,6,0.25)',
        }}
      >
        <ShieldCheck size={16} style={{ color: 'var(--color-warn-text)', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p className="text-body-xs font-semibold mb-1" style={{ color: 'var(--color-warn-text)' }}>
            Important
          </p>
          <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Data is stored in your browser's IndexedDB. Clearing browser data or
            using a different browser will lose all data. Export a backup regularly.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Validator (unchanged logic) ──────────────────────────────────────────────

function validatePayload(raw: unknown): BackupPayload {
  if (typeof raw !== 'object' || raw === null) throw new Error('Not a valid JSON object');
  const obj = raw as Record<string, unknown>;

  if (obj['schemaVersion'] !== 1) throw new Error('Unknown schemaVersion (expected 1)');
  if (!Array.isArray(obj['tickets'])) throw new Error('Missing "tickets" array');
  if (!Array.isArray(obj['items']))   throw new Error('Missing "items" array');
  if (typeof obj['exportedAt'] !== 'string') throw new Error('Missing "exportedAt" string');

  const tickets = obj['tickets'] as unknown[];
  for (const t of tickets) {
    if (typeof t !== 'object' || t === null) throw new Error('Invalid ticket entry');
    const ticket = t as Record<string, unknown>;
    if (typeof ticket['id']     !== 'string') throw new Error('Ticket missing id');
    if (typeof ticket['name']   !== 'string') throw new Error('Ticket missing name');
    if (typeof ticket['status'] !== 'string') throw new Error('Ticket missing status');
  }

  return obj as unknown as BackupPayload;
}
