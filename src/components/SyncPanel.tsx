import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, X, LogOut } from 'lucide-react';
import {
  subscribeSyncStatus,
  getSyncStatus,
  getSyncUser,
  signInToCloud,
  signOutCloud,
  syncNow,
  isOnline,
  type SyncStatus,
} from '../sync';

/** Small always-visible cloud status bar for the cashier (bottom of left panel). */
export function SyncPanel() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [hasUser] = useState(() => getSyncUser() !== null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeSyncStatus(setStatus), []);

  const online = isOnline();
  const signedIn = hasUser || status.phase === 'syncing' || status.phase === 'synced';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInToCloud(email, password);
      setShowSignIn(false);
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  const dotColor =
    status.phase === 'synced'
      ? 'var(--color-success)'
      : status.phase === 'syncing' || status.phase === 'connecting'
        ? 'var(--color-warn)'
        : 'var(--color-text-faint)';

  const statusLabel =
    status.phase === 'synced' && status.lastSyncAt
      ? `☁️ Synced ${new Date(status.lastSyncAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}`
      : status.phase === 'syncing' || status.phase === 'connecting'
        ? 'Syncing…'
        : status.phase === 'offline'
          ? 'Offline — data safe locally'
          : status.phase === 'error'
            ? status.message ?? 'Sync error'
            : online
              ? '☁️ Connected'
              : 'Offline — data safe locally';

  return (
    <div
      className="flex-shrink-0 px-4 py-2.5 flex items-center gap-2"
      style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
    >
      {signedIn ? (
        <>
          <span
            className="relative flex h-2 w-2 flex-shrink-0"
            style={{ background: dotColor, borderRadius: '99px' }}
          />
          <span className="text-body-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
            {statusLabel}
          </span>
          <button
            onClick={() => void syncNow()}
            title="Sync now"
            className="p-1.5 ml-auto rounded-lg"
            style={{ background: 'transparent', color: 'var(--color-text-faint)', border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={12} />
          </button>
          <button
            onClick={() => void signOutCloud()}
            title="Disconnect cloud"
            className="p-1.5 rounded-lg"
            style={{ background: 'transparent', color: 'var(--color-text-faint)', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={12} />
          </button>
        </>
      ) : (
        <>
          <CloudOff size={13} style={{ color: 'var(--color-text-faint)', flexShrink: 0 }} />
          <span className="text-body-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
            Cloud not connected
          </span>
          <button
            onClick={() => { setError(null); setShowSignIn(true); }}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-body-xs font-bold"
            style={{ background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <Cloud size={12} />
            Connect
          </button>
        </>
      )}


      {showSignIn && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowSignIn(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl p-5 space-y-3"
            style={{ background: 'var(--color-overlay)', border: '1px solid var(--color-border-strong)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-label-xs" style={{ color: 'var(--color-text)' }}>
                Connect to cloud
              </p>
              <button
                onClick={() => setShowSignIn(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--color-text-faint)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-2.5">
              <input
                className="input"
                type="email"
                autoComplete="username"
                placeholder="Staff email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {error && (
                <p className="text-body-xs" style={{ color: 'var(--color-error-text)' }}>
                  {error}
                </p>
              )}
              {error && (
                <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
                  Sa Firebase Console: (1) Authentication → i-enable ang <b>Email/Password</b> at
                  gumawa ng user; (2) Firestore → Rules → i-publish ang <b>firestore.rules</b>{' '}
                  (palitan ang email ng staff mo); (3) may internet ka ba?
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-ui font-bold"
                style={{
                  background: 'var(--color-brand)',
                  color: '#fff',
                  border: 'none',
                  opacity: busy ? 0.6 : 1,
                  cursor: 'pointer',
                }}
              >
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            </form>
            <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
              Isang beses ka lang maglo-login kada device — naka-save ang session.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

