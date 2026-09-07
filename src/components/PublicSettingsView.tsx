import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Save,
  ExternalLink,
  Home,
  Clock,
  Calendar,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Megaphone,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, firestore } from '../firebase';
import { getLocalPublicSettings, saveLocalPublicSettings } from '../sync';
import type { PublicSettings } from '../types';

const LIVE_URL = '/live.html';
const HOME_URL = '/home.html';
const BOOKING_URL = '/appointment.html';
const POPUP_URL = '/popup.html';
const WAIVER_URL = '/waiver.html';
const AFTERCARE_URL = '/aftercare.html';
const PRIVACY_URL = '/privacy.html';

const PREVIEW_LINKS = [
  { label: 'Home page', href: HOME_URL },
  { label: 'Live queue', href: LIVE_URL },
  { label: 'Booking', href: BOOKING_URL },
  { label: 'Next pop-up', href: POPUP_URL },
  { label: 'Before we pierce', href: WAIVER_URL },
  { label: 'Aftercare', href: AFTERCARE_URL },
  { label: 'Privacy', href: PRIVACY_URL },
];

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun', full: 'Sunday' },
  { id: 1, label: 'Mon', full: 'Monday' },
  { id: 2, label: 'Tue', full: 'Tuesday' },
  { id: 3, label: 'Wed', full: 'Wednesday' },
  { id: 4, label: 'Thu', full: 'Thursday' },
  { id: 5, label: 'Fri', full: 'Friday' },
  { id: 6, label: 'Sat', full: 'Saturday' },
];

function format12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

/** Left sidebar when in Settings tab */
export function SettingsSidebar() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Overview Pill */}
      <div
        className="p-4 rounded-2xl space-y-2"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2 text-label-xs" style={{ color: 'var(--color-brand-text)' }}>
          <Sparkles size={14} />
          <span>SETTINGS &amp; ONLINE CONTROL</span>
        </div>
        <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          Use the main workspace on the right to manage public schedules, slots, pop-up events, and incoming booking requests.
        </p>
      </div>

      {/* Quick Jump Anchors */}
      <div
        className="p-4 rounded-2xl space-y-2"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Sections</p>
        <nav className="space-y-1 text-body-xs font-semibold">
          <a
            href="#booking-schedule"
            className="block px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors no-underline"
          >
            📅 Booking &amp; Schedule
          </a>
          <a
            href="#popup-event"
            className="block px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors no-underline"
          >
            🎪 Pop-Up Event &amp; Studio
          </a>
          <a
            href="#incoming-requests"
            className="block px-3 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 transition-colors no-underline"
          >
            📥 Booking Requests
          </a>
        </nav>
      </div>

      {/* Quick Links */}
      <div
        className="p-4 rounded-2xl space-y-2.5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <ExternalLink size={14} style={{ color: 'var(--color-brand-text)' }} />
          <p className="text-label-xs text-white">Live Public Pages</p>
        </div>
        <div className="flex flex-col gap-1.5">
          {PREVIEW_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-body-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors no-underline"
            >
              <span>{l.label}</span>
              <span className="text-[11px] text-zinc-500">↗</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Main wide Settings Workspace */
export function PublicSettingsView() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [appointmentLimit, setAppointmentLimit] = useState(30);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appointments, setAppointments] = useState<Record<string, unknown>[] | null>(null);

  // New slot & blackout date inputs
  const [newSlotInput, setNewSlotInput] = useState('');
  const [newBlockDateInput, setNewBlockDateInput] = useState('');

  // Filter state for requests
  const [filterStatus, setFilterStatus] = useState<'all' | 'requested' | 'confirmed' | 'cancelled'>('all');

  useEffect(() => {
    let active = true;
    void getLocalPublicSettings()
      .then((s) => {
        if (!active) return;
        setSettings(
          s ?? {
            key: 'public',
            eventActive: false,
            bookingEnabled: true,
            bookingDays: [0, 1, 2, 3, 4, 5, 6],
            bookingSlots: ['13:00', '14:30', '16:00', '17:30', '19:00'],
            blockedDates: [],
            bookingNoticeDays: 1,
            updatedAt: 0,
          }
        );
        setLoaded(true);
      })
      .catch((e) => {
        if (active) {
          setSaveError(e instanceof Error ? e.message : 'Could not load settings.');
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);

  useEffect(() => {
    if (!user) {
      setAppointments(null);
      return;
    }
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

  function toggleDay(dayId: number) {
    if (!settings) return;
    const current = settings.bookingDays ?? [0, 1, 2, 3, 4, 5, 6];
    const exists = current.includes(dayId);
    const next = exists ? current.filter((d) => d !== dayId) : [...current, dayId].sort();
    patch('bookingDays', next);
  }

  function addTimeSlot() {
    if (!newSlotInput || !settings) return;
    const current = settings.bookingSlots ?? [];
    if (!current.includes(newSlotInput)) {
      const next = [...current, newSlotInput].sort();
      patch('bookingSlots', next);
    }
    setNewSlotInput('');
  }

  function removeTimeSlot(slot: string) {
    if (!settings) return;
    const current = settings.bookingSlots ?? [];
    patch('bookingSlots', current.filter((s) => s !== slot));
  }

  function addBlockedDate() {
    if (!newBlockDateInput || !settings) return;
    const current = settings.blockedDates ?? [];
    if (!current.includes(newBlockDateInput)) {
      const next = [...current, newBlockDateInput].sort();
      patch('blockedDates', next);
    }
    setNewBlockDateInput('');
  }

  function removeBlockedDate(dateStr: string) {
    if (!settings) return;
    const current = settings.blockedDates ?? [];
    patch('blockedDates', current.filter((d) => d !== dateStr));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    setSaveError(null);
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
        bookingEnabled: settings.bookingEnabled !== false,
        bookingDays: settings.bookingDays ?? [0, 1, 2, 3, 4, 5, 6],
        bookingSlots: settings.bookingSlots ?? ['13:00', '14:30', '16:00', '17:30', '19:00'],
        blockedDates: settings.blockedDates ?? [],
        bookingNoticeDays: settings.bookingNoticeDays ?? 1,
      });
      setSettings(next);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function manageAppointment(id: string, status: 'confirmed' | 'cancelled' | 'delete') {
    if (pendingId) return;
    setPendingId(id);
    setAppointmentError(null);
    try {
      const ref = doc(firestore, 'appointments', id);
      if (status === 'delete') {
        await deleteDoc(ref);
        setDeleteId(null);
      } else {
        await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      }
    } catch (e) {
      setAppointmentError(e instanceof Error ? e.message : 'Could not update request.');
    } finally {
      setPendingId(null);
    }
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: '20px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '13px',
    color: 'var(--color-text)',
    outline: 'none',
  };

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-zinc-400 font-medium">
        Loading settings…
      </div>
    );
  }

  const filteredAppointments = (appointments ?? []).filter((a) => {
    if (filterStatus === 'all') return true;
    return (a['status'] ?? 'requested') === filterStatus;
  });

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
        <div>
          <h1 className="font-bold text-2xl sm:text-3xl text-white tracking-tight">
            STUDIO SETTINGS &amp; ONLINE CONTROLS
          </h1>
          <p className="text-body-xs text-zinc-400 mt-0.5">
            Configure live website schedules, time slots, pop-up events, and incoming booking requests.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !settings}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-ui-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
          style={{ background: 'var(--color-brand)', boxShadow: 'var(--shadow-brand)', border: 'none' }}
        >
          <Save size={15} />
          <span>{saving ? 'Saving…' : 'Save all changes'}</span>
        </button>
      </div>

      {saveError && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-body-xs flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{saveError}</span>
        </div>
      )}

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-body-xs flex items-center gap-2 animate-pulse">
          <CheckCircle size={16} />
          <span>Settings saved successfully! Syncs to live cloud website.</span>
        </div>
      )}

      {/* ════ SECTION 1: PUBLIC BOOKING & SCHEDULE CONTROLS ════ */}
      <section id="booking-schedule" style={cardStyle} className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-violet-600/20 text-violet-400">
              <Calendar size={18} />
            </div>
            <div>
              <h2 className="font-bold text-body text-white">Online Appointment Scheduling</h2>
              <p className="text-body-xs text-zinc-400">Controls what customers can select on /appointment.html</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-body-xs font-semibold text-zinc-300">Accept Bookings:</span>
            <input
              type="checkbox"
              checked={settings?.bookingEnabled !== false}
              onChange={(e) => patch('bookingEnabled', e.target.checked)}
              className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500"
            />
          </label>
        </div>

        {/* Allowed Days of Week */}
        <div className="space-y-2">
          <label className="text-body-xs font-bold text-zinc-300 uppercase tracking-wider block">
            Allowed Booking Days
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((d) => {
              const isChecked = (settings?.bookingDays ?? [0, 1, 2, 3, 4, 5, 6]).includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  className="px-4 py-2 rounded-xl text-body-xs font-bold transition-all"
                  style={{
                    background: isChecked ? 'var(--color-brand)' : 'rgba(255,255,255,0.04)',
                    color: isChecked ? '#fff' : 'var(--color-text-muted)',
                    border: isChecked ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                  }}
                >
                  {d.full}
                </button>
              );
            })}
          </div>
        </div>

        {/* Available Time Slots Manager */}
        <div className="space-y-2.5">
          <label className="text-body-xs font-bold text-zinc-300 uppercase tracking-wider block">
            Available Time Slots
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {(settings?.bookingSlots ?? ['13:00', '14:30', '16:00', '17:30', '19:00']).map((slot) => (
              <span
                key={slot}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-body-xs font-bold bg-zinc-800/80 border border-zinc-700 text-white"
              >
                <Clock size={12} className="text-violet-400" />
                <span>{format12Hour(slot)}</span>
                <button
                  type="button"
                  onClick={() => removeTimeSlot(slot)}
                  className="p-0.5 hover:text-red-400 transition-colors"
                  title="Remove slot"
                >
                  <XCircle size={14} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 max-w-xs pt-1">
            <input
              type="time"
              value={newSlotInput}
              onChange={(e) => setNewSlotInput(e.target.value)}
              className="p-2 rounded-xl text-body-xs text-white bg-zinc-800/60 border border-zinc-700 flex-1"
            />
            <button
              type="button"
              onClick={addTimeSlot}
              disabled={!newSlotInput}
              className="px-3 py-2 rounded-xl text-body-xs font-bold bg-violet-600 text-white disabled:opacity-40"
            >
              <Plus size={14} className="inline mr-1" /> Add
            </button>
          </div>
        </div>

        {/* Blocked Dates Manager */}
        <div className="space-y-2.5 pt-2 border-t border-zinc-800">
          <label className="text-body-xs font-bold text-zinc-300 uppercase tracking-wider block">
            Blocked / Blackout Dates (e.g. Pop-up days or vacations)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {(settings?.blockedDates ?? []).length === 0 ? (
              <p className="text-body-xs text-zinc-500">No blackout dates currently set.</p>
            ) : (
              (settings?.blockedDates ?? []).map((dateStr) => (
                <span
                  key={dateStr}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-body-xs font-bold bg-red-950/40 border border-red-800/60 text-red-200"
                >
                  <span>{dateStr}</span>
                  <button
                    type="button"
                    onClick={() => removeBlockedDate(dateStr)}
                    className="p-0.5 hover:text-white transition-colors"
                    title="Remove blocked date"
                  >
                    <XCircle size={14} />
                  </button>
                </span>
              ))
            )}
          </div>

          <div className="flex items-center gap-2 max-w-xs pt-1">
            <input
              type="date"
              value={newBlockDateInput}
              onChange={(e) => setNewBlockDateInput(e.target.value)}
              className="p-2 rounded-xl text-body-xs text-white bg-zinc-800/60 border border-zinc-700 flex-1"
            />
            <button
              type="button"
              onClick={addBlockedDate}
              disabled={!newBlockDateInput}
              className="px-3 py-2 rounded-xl text-body-xs font-bold bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
            >
              <Plus size={14} className="inline mr-1" /> Block date
            </button>
          </div>
        </div>
      </section>

      {/* ════ SECTION 2: POP-UP EVENT & HOME STUDIO PROFILE ════ */}
      <section id="popup-event" style={cardStyle} className="p-6 space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-600/20 text-amber-400">
            <Megaphone size={18} />
          </div>
          <div>
            <h2 className="font-bold text-body text-white">Next Pop-Up Event &amp; Studio Profile</h2>
            <p className="text-body-xs text-zinc-400">Shown on /popup.html, /live.html, and the home page</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2">
            <span className="text-body-xs text-zinc-400 font-semibold">Pop-up Headline / Event Title</span>
            <input
              style={inputStyle}
              placeholder="e.g. Solis Market Pop-Up"
              value={settings?.eventTitle ?? ''}
              onChange={(e) => patch('eventTitle', e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-body-xs text-zinc-400 font-semibold">Event Date (YYYY-MM-DD)</span>
            <input
              type="date"
              style={inputStyle}
              value={settings?.eventDate ?? ''}
              onChange={(e) => patch('eventDate', e.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-body-xs text-zinc-400 font-semibold">Operating Hours</span>
            <input
              style={inputStyle}
              placeholder="e.g. 10:00 AM – 8:00 PM"
              value={settings?.eventHours ?? ''}
              onChange={(e) => patch('eventHours', e.target.value)}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-body-xs text-zinc-400 font-semibold">Venue Location</span>
            <input
              style={inputStyle}
              placeholder="e.g. The Tent at Acacia Estates, Taguig"
              value={settings?.eventLocation ?? ''}
              onChange={(e) => patch('eventLocation', e.target.value)}
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-body-xs text-zinc-400 font-semibold">Google Maps Link</span>
            <input
              type="url"
              style={inputStyle}
              placeholder="https://maps.app.goo.gl/…"
              value={settings?.eventMapUrl ?? ''}
              onChange={(e) => patch('eventMapUrl', e.target.value)}
            />
          </label>

          <div className="sm:col-span-2 p-3 rounded-xl bg-violet-950/20 border border-violet-800/40">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings?.eventActive ?? false}
                onChange={(e) => patch('eventActive', e.target.checked)}
                className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
              />
              <span className="text-body-xs font-semibold text-zinc-200">
                Advertise this pop-up event live on the website
              </span>
            </label>
          </div>
        </div>

        {/* Home Studio Details */}
        <div className="pt-4 border-t border-zinc-800 space-y-3">
          <div className="flex items-center gap-2">
            <Home size={16} className="text-violet-400" />
            <h3 className="font-bold text-body-sm text-white">Private Home Studio Location (When No Pop-Up)</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-body-xs text-zinc-400 font-semibold">Home Studio Name</span>
              <input
                style={inputStyle}
                placeholder="PUNKTURE STUDIOS — Private Studio"
                value={settings?.studioName ?? ''}
                onChange={(e) => patch('studioName', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-body-xs text-zinc-400 font-semibold">Google Maps Link</span>
              <input
                type="url"
                style={inputStyle}
                placeholder="https://maps.app.goo.gl/…"
                value={settings?.studioMapUrl ?? ''}
                onChange={(e) => patch('studioMapUrl', e.target.value)}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-body-xs text-zinc-400 font-semibold">Studio Address</span>
              <input
                style={inputStyle}
                placeholder="Private residential address (shared with booked clients)"
                value={settings?.studioAddress ?? ''}
                onChange={(e) => patch('studioAddress', e.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      {/* ════ SECTION 3: INCOMING BOOKING REQUESTS ════ */}
      <section id="incoming-requests" style={cardStyle} className="p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-600/20 text-emerald-400">
              <CalendarCheck size={18} />
            </div>
            <div>
              <h2 className="font-bold text-body text-white">Incoming Customer Appointments</h2>
              <p className="text-body-xs text-zinc-400">Review, confirm, and manage customer booking requests</p>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            {(['all', 'requested', 'confirmed', 'cancelled'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-colors"
                style={{
                  background: filterStatus === st ? 'var(--color-brand)' : 'transparent',
                  color: filterStatus === st ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                {st === 'requested' ? 'Pending' : st}
              </button>
            ))}
          </div>
        </div>

        {appointmentError && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-body-xs">
            {appointmentError}
          </div>
        )}

        {!user ? (
          <div className="p-6 text-center text-body-xs text-zinc-400 space-y-1">
            <p>☁️ Cloud synchronization is not signed in.</p>
            <p className="text-[11px] text-zinc-500">Sign in using the bottom sync bar to load live requests.</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-8 text-center text-body-xs text-zinc-500">
            No appointment requests found under this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredAppointments.map((a) => {
              const id = String(a['id']);
              const status = String(a['status'] ?? 'requested');
              const isDeleting = deleteId === id;

              return (
                <div
                  key={id}
                  className="rounded-2xl p-4 space-y-3 transition-all"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-body text-white">{String(a['name'] ?? '—')}</span>
                      <span
                        className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{
                          background:
                            status === 'requested'
                              ? 'rgba(217,119,6,0.18)'
                              : status === 'confirmed'
                              ? 'rgba(16,185,129,0.18)'
                              : 'rgba(239,68,68,0.18)',
                          color:
                            status === 'requested'
                              ? '#fbbf24'
                              : status === 'confirmed'
                              ? '#34d399'
                              : '#f87171',
                          border: `1px solid ${
                            status === 'requested'
                              ? 'rgba(217,119,6,0.35)'
                              : status === 'confirmed'
                              ? 'rgba(16,185,129,0.35)'
                              : 'rgba(239,68,68,0.35)'
                          }`,
                        }}
                      >
                        {status === 'requested' ? 'Pending' : status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-body-xs font-mono font-bold text-zinc-300">
                      <span>📅 {String(a['date'] ?? '—')}</span>
                      <span>·</span>
                      <span>🕒 {format12Hour(String(a['time'] ?? '—'))}</span>
                    </div>
                  </div>

                  {/* Customer Contact & Notes */}
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-3 text-body-xs">
                    <div className="space-y-1">
                      <p className="text-zinc-400">
                        Contact:{' '}
                        <span className="font-bold text-white selection:bg-violet-500">
                          {String(a['contact'] ?? '—')}
                        </span>
                      </p>
                      {Boolean(a['notes']) && (
                        <p className="text-zinc-300 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800 font-mono text-[12px] leading-relaxed">
                          {String(a['notes'])}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                      {status !== 'confirmed' && (
                        <button
                          type="button"
                          disabled={pendingId !== null}
                          onClick={() => manageAppointment(id, 'confirmed')}
                          className="px-3 py-1.5 rounded-xl font-bold text-body-xs bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                        >
                          Confirm
                        </button>
                      )}

                      {status !== 'cancelled' && (
                        <button
                          type="button"
                          disabled={pendingId !== null}
                          onClick={() => manageAppointment(id, 'cancelled')}
                          className="px-3 py-1.5 rounded-xl font-bold text-body-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                      )}

                      {isDeleting ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={pendingId !== null}
                            onClick={() => manageAppointment(id, 'delete')}
                            className="px-2.5 py-1.5 rounded-xl font-bold text-[11px] bg-red-600 text-white"
                          >
                            Yes, delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(null)}
                            className="px-2 py-1.5 rounded-xl text-[11px] text-zinc-400 hover:text-white"
                          >
                            Keep
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteId(id)}
                          className="p-1.5 rounded-xl text-zinc-500 hover:text-red-400 transition-colors"
                          title="Delete record"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {appointments && appointments.length >= appointmentLimit && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setAppointmentLimit((n) => n + 20)}
              className="text-body-xs font-bold text-violet-400 hover:text-white underline underline-offset-4"
            >
              Load more requests
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
