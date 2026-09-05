import { useEffect, useState } from 'react';
import { Megaphone, CalendarCheck, Save } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, firestore } from '../firebase';
import {
  getLocalPublicSettings,
  saveLocalPublicSettings,
} from '../sync';
import type { PublicSettings } from '../types';

/** 🌐 Public tab — staff controls what the public live page advertises. */
export function PublicSettingsView() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [appointments, setAppointments] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    let active = true;
    void getLocalPublicSettings().then((s) => {
      if (!active) return;
      setSettings(s);
      setLoaded(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  // Staff peek at home-studio appointment requests (read-only for now).
  useEffect(() => {
    if (!user) { setAppointments(null); return; }
    const q = query(collection(firestore, 'appointments'), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Record<string, unknown>[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        setAppointments(out);
      },
      () => setAppointments([])
    );
    return unsub;
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaved(false);
    const next = await saveLocalPublicSettings({
      eventDate: settings.eventDate?.trim() ? settings.eventDate.trim() : undefined,
      eventLocation: settings.eventLocation?.trim() ? settings.eventLocation.trim() : undefined,
      eventNote: settings.eventNote?.trim() ? settings.eventNote.trim() : undefined,
      eventActive: settings.eventActive,
    });
    setSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  const card: React.CSSProperties = {
    borderRadius: '14px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  };

  if (!loaded) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-5" style={{ color: 'var(--color-text-faint)' }}>
        Loading…
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--color-border)',
    borderRadius: '10px',
    padding: '9px 11px',
    fontSize: '13px',
    color: 'var(--color-text)',
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
      {/* Next pop-up editor */}
      <div style={card} className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone size={14} style={{ color: 'var(--color-warn-text)' }} />
          <p className="text-label-xs" style={{ color: 'var(--color-text)' }}>
            Next pop-up event
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-2.5">
          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Date</span>
            <input
              type="date"
              style={inputStyle}
              value={settings?.eventDate ?? ''}
              onChange={(e) => setSettings((s) => (s ? { ...s, eventDate: e.target.value } : s))}
            />
          </label>
          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Location / venue</span>
            <input
              type="text"
              placeholder="e.g. BGC High Street, Taguig"
              style={inputStyle}
              value={settings?.eventLocation ?? ''}
              onChange={(e) => setSettings((s) => (s ? { ...s, eventLocation: e.target.value } : s))}
            />
          </label>
          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Short promo note</span>
            <input
              type="text"
              placeholder="e.g. 20% off first piercings!"
              style={inputStyle}
              value={settings?.eventNote ?? ''}
              onChange={(e) => setSettings((s) => (s ? { ...s, eventNote: e.target.value } : s))}
            />
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings?.eventActive ?? false}
              onChange={(e) => setSettings((s) => (s ? { ...s, eventActive: e.target.checked } : s))}
            />
            <span className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
              I-advertise ito sa public page (pag walang live queue)
            </span>
          </label>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-ui font-bold"
            style={{ background: 'var(--color-warn)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <Save size={14} />
            Save &amp; publish
          </button>
        </form>
        {saved && (
          <p className="text-body-xs font-semibold" style={{ color: 'var(--color-success-text)' }}>
            ✓ Saved on this device — mag-u-upload sa cloud pag online.
          </p>
        )}
        <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
          Nakikita ito ng public page bilang "Next pop-up" kasama ang Book appointment button.
        </p>
      </div>

      {/* Home studio appointment requests (staff only peek) */}
      <div style={card} className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} style={{ color: 'var(--color-brand-text)' }} />
          <p className="text-label-xs" style={{ color: 'var(--color-text)' }}>
            Home studio appointment requests
          </p>
        </div>

        {!user ? (
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
            ☁️ Connect to cloud (bottom bar) para makita ang mga booking requests.
          </p>
        ) : appointments === null ? (
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Loading…</p>
        ) : appointments.length === 0 ? (
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
            Wala pang appointment requests.
          </p>
        ) : (
          <div className="space-y-2">
            {appointments.map((a) => (
              <div
                key={String(a['id'])}
                className="rounded-xl p-3 space-y-1"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body-xs font-bold truncate" style={{ color: 'var(--color-text)' }}>
                    {String(a['name'] ?? '—')}
                  </p>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                      background:
                        a['status'] === 'requested'
                          ? 'rgba(217,119,6,0.15)'
                          : a['status'] === 'confirmed'
                            ? 'rgba(16,185,129,0.15)'
                            : 'rgba(255,255,255,0.08)',
                      color:
                        a['status'] === 'requested'
                          ? 'var(--color-warn-text)'
                          : a['status'] === 'confirmed'
                            ? 'var(--color-success-text)'
                            : 'var(--color-text-muted)',
                    }}
                  >
                    {String(a['status'] ?? 'requested').toUpperCase()}
                  </span>
                </div>
                <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
                  📅 {String(a['date'] ?? '—')} · {String(a['time'] ?? '—')} · {String(a['contact'] ?? '')}
                </p>
                {a['notes'] ? (
                  <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
                    {String(a['notes'])}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
        <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
          Confirm / approve workflow — darating sa susunod na update.
        </p>
      </div>
    </div>
  );
}

