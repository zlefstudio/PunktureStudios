import { useRef, useState } from 'react';
import { FileSpreadsheet, Download, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import type { Ticket, BackupPayload } from '../types';
import { formatDate, formatTime, calcTotal, ticketItems } from './utils';

/**
 * Data tools for the History tab (replaces the old dedicated Backup tab):
 *  · Export to Excel (CSV) — the records currently shown by the filter.
 *  · Full backup (JSON)     — exact restore copy.
 *  · Restore (JSON)         — import a backup file.
 */

interface Props {
  /** Finished/cancelled tickets currently displayed by the History filter. */
  historyTickets: Ticket[];
  scopeLabel: string;
}

function csvCell(value: string | number | undefined): string {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function timestampFileName(prefix: string, ext: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.${ext}`;
}

export function DataTools({ historyTickets, scopeLabel }: Props) {
  const items     = useStore((s) => s.items);
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importError,    setImportError]    = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);
  const [importing,      setImporting]      = useState(false);
  const [message,        setMessage]        = useState<string | null>(null);

  function flash(msg: string) {
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 4000);
  }

  // ── Excel (CSV) export of the currently filtered records ──
  function handleExportCsv() {
    const header = [
      'Date', 'Time', 'Ticket #', 'Client', 'Status',
      'Placement', 'Member', 'Base', 'Upgrade', 'Upgrade Price', 'Qty', 'Line Total', 'Ticket Total',
    ];
    const rows: string[][] = [];

    for (const t of historyTickets) {
      const time = t.finishedAt ?? t.cancelledAt ?? t.createdAt;
      const date = formatDate(time);
      const clock = formatTime(time);
      const myItems = ticketItems(items, t.id);
      const ticketTotal = calcTotal(myItems);
      const status = t.status === 'finished' ? 'Finished' : 'Cancelled';

      if (myItems.length === 0) {
        rows.push([date, clock, String(t.ticketNumber), t.name, status, '(no items)', '', '', '', '', '', '', String(ticketTotal)]);
      } else {
        for (const it of myItems) {
          const lineTotal = (it.basePrice + it.upgradePrice) * it.quantity;
          rows.push([
            date, clock, String(t.ticketNumber), t.name, status,
            it.placementName, it.memberLabel ?? '', String(it.basePrice),
            it.upgradePrice === 0 ? 'Free' : it.upgradeLabel, String(it.upgradePrice),
            String(it.quantity), String(lineTotal), String(ticketTotal),
          ]);
        }
      }
    }

    const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = timestampFileName('punkture-orders', 'csv');
    a.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${rows.length} line${rows.length === 1 ? '' : 's'} to Excel (${scopeLabel}).`);
  }

  // ── Full JSON backup export ──
  function handleExportJson() {
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      ...exportBackup(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = timestampFileName('piercing-backup', 'json');
    a.click();
    URL.revokeObjectURL(url);
    flash('Full backup downloaded. Save it somewhere safe.');
  }

  // ── JSON restore ──
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError(null);
    setPendingPayload(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string) as unknown;
        setPendingPayload(validatePayload(raw));
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Invalid backup file');
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
      flash(`Restored ${pendingPayload.tickets.length} tickets, ${pendingPayload.items.length} items.`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setImporting(false);
    }
  }

  const btn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '8px 10px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: 700,
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    color: '#fff',
  };

  return (
    <div
      className="rounded-2xl p-3 space-y-2.5"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-label-xs" style={{ color: 'var(--color-text-faint)' }}>
          Data tools
        </p>
        {message && (
          <p className="text-body-xs font-semibold" style={{ color: 'var(--color-success-text)' }}>
            {message}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleExportCsv}
          title="Download the currently filtered records as an Excel-compatible CSV file"
          style={{ ...btn, background: 'var(--color-brand)' }}
        >
          <FileSpreadsheet size={13} />
          Excel ({scopeLabel})
        </button>
        <button
          onClick={handleExportJson}
          title="Download a full backup file (exact copy for restoring later)"
          style={{ ...btn, background: 'var(--color-success)' }}
        >
          <Download size={13} />
          Full backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          title="Restore data from a full backup (.json) file"
          style={{ ...btn, background: 'rgba(255,255,255,0.12)', border: '1px solid var(--color-border)' }}
        >
          <Upload size={13} />
          Restore
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleFileSelect} />
      </div>


      {importError && (
        <p className="text-body-xs" style={{ color: 'var(--color-error-text)' }}>
          {importError}
        </p>
      )}

      {pendingPayload && (
        <div
          className="rounded-xl p-3 space-y-2"
          style={{ background: 'var(--color-warn-bg)', border: '1px solid rgba(217,119,6,0.25)' }}
        >
          <p className="flex items-center gap-1.5 text-body-xs font-semibold" style={{ color: 'var(--color-warn-text)' }}>
            <AlertTriangle size={12} />
            Restore will replace ALL current data!
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
              className="flex-1 py-2 rounded-lg text-body-xs font-semibold"
              style={{ background: 'var(--color-warn)', color: '#fff', border: 'none', opacity: importing ? 0.5 : 1 }}
            >
              {importing ? 'Restoring…' : 'Yes, Replace Data'}
            </button>
            <button
              onClick={() => setPendingPayload(null)}
              className="flex-1 py-2 rounded-lg text-body-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <p
        className="flex items-start gap-1.5 text-body-xs leading-relaxed"
        style={{ color: 'var(--color-text-faint)' }}
      >
        <ShieldCheck size={13} style={{ flexShrink: 0, marginTop: 2 }} />
        Data is saved locally in this browser. Export a backup regularly and keep it somewhere safe (USB / Drive).
      </p>
    </div>
  );
}

// ── Backup file validator ──
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

