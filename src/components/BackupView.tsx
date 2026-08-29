import { useRef, useState } from 'react';
import { Download, Upload, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import type { BackupPayload } from '../types';

export function BackupView() {
  const exportBackup = useStore((s) => s.exportBackup);
  const importBackup = useStore((s) => s.importBackup);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  function handleExport() {
    const { tickets, items } = exportBackup();
    const payload: BackupPayload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tickets,
      items,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    const a = document.createElement('a');
    a.href = url;
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
        const raw = JSON.parse(ev.target?.result as string) as unknown;
        const payload = validatePayload(raw);
        setPendingPayload(payload);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Invalid file');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
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

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">Export Backup</h3>
        <p className="text-xs text-slate-500">
          Downloads all tickets and items as a JSON file. Save it somewhere safe.
        </p>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
        >
          <Download size={16} />
          Export JSON Backup
        </button>
        {success && (
          <p className="text-xs text-emerald-400 bg-emerald-950/50 rounded px-2 py-1.5">{success}</p>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
        <h3 className="text-sm font-bold text-white">Import Backup</h3>
        <p className="text-xs text-slate-500">
          Replaces ALL current data with the backup file. This cannot be undone.
        </p>

        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
        >
          <Upload size={16} />
          Choose Backup File
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {importError && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-950/40 rounded p-2.5">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            <span>{importError}</span>
          </div>
        )}

        {pendingPayload && (
          <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 space-y-2">
            <p className="text-xs text-amber-300 font-semibold flex items-center gap-1.5">
              <AlertTriangle size={13} />
              This will replace all current data!
            </p>
            <p className="text-xs text-slate-400">
              {pendingPayload.tickets.length} tickets · {pendingPayload.items.length} items
              <br />
              Exported: {new Date(pendingPayload.exportedAt).toLocaleString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmImport}
                disabled={importing}
                className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {importing ? 'Importing…' : 'Yes, Replace Data'}
              </button>
              <button
                onClick={() => setPendingPayload(null)}
                className="flex-1 py-2 rounded-lg bg-white/8 hover:bg-white/15 text-slate-300 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
        <p className="text-xs text-amber-400 font-semibold mb-1">⚠️ Important</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Data is stored in your browser's IndexedDB. Clearing browser data or
          using a different browser will lose all data. Export a backup regularly.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

function validatePayload(raw: unknown): BackupPayload {
  if (typeof raw !== 'object' || raw === null) throw new Error('Not a valid JSON object');
  const obj = raw as Record<string, unknown>;

  if (obj['schemaVersion'] !== 1) throw new Error('Unknown schemaVersion (expected 1)');
  if (!Array.isArray(obj['tickets'])) throw new Error('Missing "tickets" array');
  if (!Array.isArray(obj['items'])) throw new Error('Missing "items" array');
  if (typeof obj['exportedAt'] !== 'string') throw new Error('Missing "exportedAt" string');

  // Basic ticket shape check on first item
  const tickets = obj['tickets'] as unknown[];
  for (const t of tickets) {
    if (typeof t !== 'object' || t === null) throw new Error('Invalid ticket entry');
    const ticket = t as Record<string, unknown>;
    if (typeof ticket['id'] !== 'string') throw new Error('Ticket missing id');
    if (typeof ticket['name'] !== 'string') throw new Error('Ticket missing name');
    if (typeof ticket['status'] !== 'string') throw new Error('Ticket missing status');
  }

  return obj as unknown as BackupPayload;
}
