import { useEffect, useState } from 'react';
import { Megaphone, CalendarCheck, Save, ExternalLink, Home } from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, firestore } from '../firebase';
import { getLocalPublicSettings, saveLocalPublicSettings } from '../sync';
import type { PublicSettings } from '../types';

const LIVE_URL = 'https://punkture-studios.web.app/';
const BOOKING_URL = 'https://punkture-studios.web.app/appointment';
const WAIVER_URL = 'https://punkture-studios.web.app/waiver';
const AFTERCARE_URL = 'https://punkture-studios.web.app/aftercare';
const PRIVACY_URL = 'https://punkture-studios.web.app/privacy';

const PREVIEW_LINKS = [
  { label: '🔗 Live queue', href: LIVE_URL },
  { label: '📅 Booking', href: BOOKING_URL },
  { label: '🩺 Waiver', href: WAIVER_URL },
  { label: '🩹 Aftercare', href: AFTERCARE_URL },
  { label: '🔒 Privacy', href: PRIVACY_URL },
];

/** 🌐 Public tab — staff controls everything the public pages show. */
export function PublicSettingsView() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [appointmentLimit, setAppointmentLimit] = useState(20);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appointments, setAppointments] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    let active = true;
    void getLocalPublicSettings().then((s) => {
      if (!active) return;
      setSettings(s ?? { key: 'public', eventActive: false, updatedAt: 0 });
      setLoaded(true);
    }).catch(e => { if (active) { setSaveError(e instanceof Error ? e.message : 'Could not load settings.'); setLoaded(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    if (!user) { setAppointments(null); return; }
    setAppointmentError(null);
    const q = query(collection(firestore, 'appointments'), orderBy('createdAt', 'desc'), limit(appointmentLimit));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const out: Record<string, unknown>[] = [];
        snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
        setAppointments(out);
        setAppointmentError(null);
      },
      (e) => setAppointmentError('Could not load requests: ' + e.message)
    );
    return unsub;
  }, [user, appointmentLimit]);

  function patch<K extends keyof PublicSettings>(key: K, value: PublicSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || saving) return;
    setSaving(true); setSaveError(null);
    setSaved(false);
    try {
      const next = await saveLocalPublicSettings({
        eventDate: settings.eventDate?.trim() ? settings.eventDate.trim() : undefined,
        eventTitle: settings.eventTitle?.trim() ? settings.eventTitle.trim() : undefined,
        eventHours: settings.eventHours?.trim() ? settings.eventHours.trim() : undefined,
        eventLocation: settings.eventLocation?.trim() ? settings.eventLocation.trim() : undefined,
        eventMapUrl: settings.eventMapUrl?.trim() ? settings.eventMapUrl.trim() : undefined,
        studioName: settings.studioName?.trim() ? settings.studioName.trim() : undefined,
        studioAddress: settings.studioAddress?.trim() ? settings.studioAddress.trim() : undefined,
        studioMapUrl: settings.studioMapUrl?.trim() ? settings.studioMapUrl.trim() : undefined,
        eventActive: settings.eventActive,
      });
      setSettings(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) { setSaveError(e instanceof Error ? e.message : 'Could not save settings.'); } finally { setSaving(false); }
  }

  async function manageAppointment(id: string, status: 'confirmed' | 'cancelled' | 'delete') {
    if (pendingId) return;
    setPendingId(id); setAppointmentError(null);
    try {
      const ref = doc(firestore, 'appointments', id);
      if (status === 'delete') { await deleteDoc(ref); setDeleteId(null); }
      else await updateDoc(ref, { status, updatedAt: serverTimestamp() });
    } catch (e) { setAppointmentError(e instanceof Error ? e.message : 'Could not update request.'); }
    finally { setPendingId(null); }
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
      {saveError && <p role="alert" className="text-red-400">{saveError}</p>}
      {/* Public pages preview */}
      <div style={card} className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ExternalLink size={14} style={{ color: 'var(--color-brand-text)' }} />
          <p className="text-label-xs" style={{ color: 'var(--color-text)' }}>
            Public pages (what customers see)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl text-body-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text)', border: '1px solid var(--color-border-strong)', textDecoration: 'none' }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* Live website settings */}
      <form onSubmit={handleSave} className="space-y-4">
        <div style={card} className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Megaphone size={14} style={{ color: 'var(--color-brand-text)' }} />
            <p className="text-label-xs" style={{ color: 'var(--color-text)' }}>
              Next pop-up
            </p>
          </div>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Save-the-date headline</span>
            <input style={inputStyle} placeholder="Next pop-up coming soon" value={settings?.eventTitle ?? ''} onChange={(e) => patch('eventTitle', e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Date</span>
              <input type="date" style={inputStyle} value={settings?.eventDate ?? ''} onChange={(e) => patch('eventDate', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Hours</span>
              <input style={inputStyle} placeholder="10:00 AM – 8:00 PM" value={settings?.eventHours ?? ''} onChange={(e) => patch('eventHours', e.target.value)} />
            </label>
          </div>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Location / venue</span>
            <input style={inputStyle} placeholder="e.g. SM Mall of Asia" value={settings?.eventLocation ?? ''} onChange={(e) => patch('eventLocation', e.target.value)} />
          </label>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Map link (Google Maps / Waze)</span>
            <input type="url" style={inputStyle} placeholder="https://maps.app.goo.gl/…" value={settings?.eventMapUrl ?? ''} onChange={(e) => patch('eventMapUrl', e.target.value)} />
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings?.eventActive ?? false} onChange={(e) => patch('eventActive', e.target.checked)} style={{ accentColor: 'var(--color-brand)' }} />
            <span className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
              Advertise this on the public page (when there's no live queue)
            </span>
          </label>
        </div>

        <div style={card} className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Home size={14} style={{ color: 'var(--color-brand-text)' }} />
            <p className="text-label-xs" style={{ color: 'var(--color-text)' }}>
              Home studio (no pop-up)
            </p>
          </div>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Studio name</span>
            <input style={inputStyle} placeholder="PUNKTURE STUDIOS — Home Studio" value={settings?.studioName ?? ''} onChange={(e) => patch('studioName', e.target.value)} />
          </label>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Address</span>
            <input style={inputStyle} placeholder="Condo address" value={settings?.studioAddress ?? ''} onChange={(e) => patch('studioAddress', e.target.value)} />
          </label>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Map link</span>
            <input type="url" style={inputStyle} placeholder="https://maps.app.goo.gl/…" value={settings?.studioMapUrl ?? ''} onChange={(e) => patch('studioMapUrl', e.target.value)} />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !settings}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-body-xs font-bold"
            style={{ background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            <Save size={13} /> Save settings
          </button>
          {saved && (
            <p className="text-body-xs font-semibold" style={{ color: 'var(--color-success-text)' }}>
              ✓ Saved — uploads to the cloud when online.
            </p>
          )}
        </div>
      </form>

      {/* Home studio appointment requests */}
      <div style={card} className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={14} style={{ color: 'var(--color-brand-text)' }} />
          <p className="text-label-xs" style={{ color: 'var(--color-text)' }}>
            Home studio appointment requests
          </p>
        </div>

        {appointmentError && <p role="alert" className="text-red-400">{appointmentError}</p>}
        {!user ? (
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
            ☁️ Connect to cloud (bottom bar) to see booking requests.
          </p>
        ) : appointments === null ? (
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Loading…</p>
        ) : appointments.length === 0 && !appointmentError ? (
          <p className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>
            No appointment requests yet.
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
                <div className="flex flex-wrap gap-3 text-xs">
                  <button disabled={pendingId !== null || a['status'] === 'confirmed'} onClick={() => manageAppointment(String(a['id']), 'confirmed')}>Confirm</button>
                  <button disabled={pendingId !== null || a['status'] === 'cancelled'} onClick={() => manageAppointment(String(a['id']), 'cancelled')}>Cancel</button>
                  {deleteId === a['id'] ? <><span>Delete personal data permanently?</span><button disabled={pendingId !== null} onClick={() => manageAppointment(String(a['id']), 'delete')}>Yes, delete</button><button onClick={() => setDeleteId(null)}>Keep</button></> : <button onClick={() => setDeleteId(String(a['id']))}>Delete</button>}
                </div>
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
          Confirm records your decision here. Contact the customer separately to let them know.
        </p>
        {appointments && appointments.length >= appointmentLimit && <button onClick={() => setAppointmentLimit(n => n + 20)} className="text-sm underline">Load more requests</button>}
      </div>
    </div>
  );
}

