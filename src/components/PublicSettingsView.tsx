import { editableEvents } from '../popupEvents';
import { DateAvailabilityEditor } from './booking/DateAvailabilityEditor';
import { PaidBookingsView } from './booking/PaidBookingsView';
import { useEffect, useState } from 'react';
import {
  CalendarCheck,
  Save,
  ExternalLink,
  Home,
  Clock,
  Calendar,
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
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, firestore } from '../firebase';
import { getLocalPublicSettings, saveLocalPublicSettings, syncNow } from '../sync';
import type { PublicSettings } from '../types';
import {
  DEFAULT_DAYS,
  DEFAULT_SLOTS,
  SLOT_INTERVAL_MINUTES,
  flattenDaySlots,
  editableDaySlots,
  slotsOverlap,
  validSlotTime,
  upgradeLegacySchedule,
  format12Hour,
  slotRangesLabel,
  slotsForDay,
  studioDaySlots,
  studioHoursLabel,
  studioSlotsForDay,
} from '../schedule';

const LIVE_URL = 'https://punkture-studios.web.app/live.html';
const HOME_URL = 'https://punkture-studios.web.app/home.html';
const BOOKING_URL = 'https://punkture-studios.web.app/appointment.html';
const POPUP_URL = 'https://punkture-studios.web.app/popup.html';
const WAIVER_URL = 'https://punkture-studios.web.app/waiver.html';
const AFTERCARE_URL = 'https://punkture-studios.web.app/aftercare.html';
const PRIVACY_URL = 'https://punkture-studios.web.app/privacy.html';

const PREVIEW_LINKS = [
  { label: 'Home page', href: HOME_URL },
  { label: 'Live queue', href: LIVE_URL },
  { label: 'Booking', href: BOOKING_URL },
  { label: 'Next pop-up', href: POPUP_URL },
  { label: 'Before we pierce', href: WAIVER_URL },
  { label: 'Aftercare', href: AFTERCARE_URL },
  { label: 'Privacy', href: PRIVACY_URL },
];

type SettingsTab = 'bookings' | 'schedule' | 'popups' | 'legacy';

/**
 * Panel switcher metadata. Every panel keeps its original anchor id so the
 * sidebar deep links (#paid-bookings, #booking-schedule, …) still resolve; the
 * hash listener below opens the matching panel instead of scrolling a hidden one.
 */
const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'bookings', label: 'Bookings & deposits' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'popups', label: 'Pop-ups & studio' },
  { id: 'legacy', label: 'Legacy requests' },
];
const ANCHORS: Record<SettingsTab, string> = {
  bookings: 'paid-bookings',
  schedule: 'booking-schedule',
  popups: 'popup-event',
  legacy: 'incoming-requests',
};

const DAYS_OF_WEEK = [
  { id: 0, label: 'Sun', full: 'Sunday' },
  { id: 1, label: 'Mon', full: 'Monday' },
  { id: 2, label: 'Tue', full: 'Tuesday' },
  { id: 3, label: 'Wed', full: 'Wednesday' },
  { id: 4, label: 'Thu', full: 'Thursday' },
  { id: 5, label: 'Fri', full: 'Friday' },
  { id: 6, label: 'Sat', full: 'Saturday' },
];

/**
 * Slots currently in effect for one weekday: the saved per-weekday grid, else
 * the legacy flat list, else the built-in studio hours (Saturday is shorter
 * than Mon–Fri). This mirrors what the booking page and Worker resolve.
 */
function daySlotsOf(settings: PublicSettings | null, dayId: number): string[] {
  return slotsForDay(settings, dayId);
}

/** True when the saved grid is exactly the built-in studio hours. */
function matchesStudioHours(settings: PublicSettings | null): boolean {
  const map = settings?.bookingDaySlots;
  if (!map || Object.keys(map).length !== DEFAULT_DAYS.length) return false;
  return DEFAULT_DAYS.every((day) => (map[String(day)] ?? []).join('|') === studioSlotsForDay(day).join('|'));
}

/** Left sidebar when in Settings tab */
export function SettingsSidebar() {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* Quick Links */}
      <div
        className="p-4 rounded-2xl space-y-2.5"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <ExternalLink size={14} style={{ color: 'var(--color-brand-text)' }} />
          <p className="text-label-xs text-white">Live website pages</p>
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
              <span className="min-w-0"><span className="block">{l.label}</span><span className="block break-all text-xs font-normal text-zinc-400 mt-1">{l.href}</span></span>
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
  const [savedMessage, setSavedMessage] = useState('Settings saved successfully!');
  const [user, setUser] = useState<User | null>(null);
  const [appointmentLimit, setAppointmentLimit] = useState(30);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [appointments, setAppointments] = useState<Record<string, unknown>[] | null>(null);

  // New slot & blackout date inputs
  const [newSlotInputs, setNewSlotInputs] = useState<Record<number, string>>({});
  const [scheduleNotice, setScheduleNotice] = useState('');

  // Filter state for requests
  const [filterStatus, setFilterStatus] = useState<'all' | 'requested' | 'confirmed' | 'cancelled'>('all');

  // Which settings panel is open. Keeps the workspace short instead of one long scroll.
  const [tab, setTab] = useState<SettingsTab>('bookings');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [legacyNotice, setLegacyNotice] = useState('');

  useEffect(() => {
    let active = true;
    void getLocalPublicSettings()
      .then((s) => {
        if (!active) return;
        setSettings(
          s ? upgradeLegacySchedule(s) : {
            key: 'public',
            eventActive: false,
            bookingEnabled: true,
            bookingDays: [...DEFAULT_DAYS],
            bookingSlots: [...DEFAULT_SLOTS],
            bookingDaySlots: studioDaySlots(),
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

  // Sidebar links are plain anchors; open the panel that owns the clicked anchor.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace('#', '');
      const match = (Object.entries(ANCHORS) as [SettingsTab, string][]).find(([, anchor]) => anchor === hash);
      if (match) setTab(match[0]);
    };
    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, []);

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

  /** Toggling a day keeps its per-weekday grid in step (days off are removed). */
  function toggleDay(dayId: number) {
    setSettings((s) => {
      if (!s) return s;
      const current = s.bookingDays ?? [...DEFAULT_DAYS];
      const exists = current.includes(dayId);
      const bookingDays = exists
        ? current.filter((d) => d !== dayId)
        : [...current, dayId].sort((a, b) => a - b);
      const map = editableDaySlots(s);
      if (exists) delete map[String(dayId)];
      else if (!(map[String(dayId)] ?? []).length) map[String(dayId)] = studioSlotsForDay(dayId);
      return { ...s, bookingDays, bookingDaySlots: map };
    });
  }

  function setDaySlots(dayId: number, slots: string[]) {
    setSettings((s) => (s ? { ...s, bookingDaySlots: { ...editableDaySlots(s), [String(dayId)]: slots } } : s));
  }

  function addTimeSlot(dayId: number) {
    const newSlotInput = newSlotInputs[dayId];
    if (!newSlotInput || !settings) return;
    const current = daySlotsOf(settings, dayId);
    if (!validSlotTime(newSlotInput)) {
      setScheduleNotice('Keep the full 12–1 PM lunch break and finish appointments before midnight.');
      return;
    }
    if (current.some(slot => slotsOverlap(slot, newSlotInput))) {
      setScheduleNotice('Leave at least 45 minutes between appointments. Remove the overlapping time first.');
      return;
    }
    setDaySlots(dayId, [...current, newSlotInput].sort());
    setNewSlotInputs(inputs => ({ ...inputs, [dayId]: '' }));
    setScheduleNotice('');
  }

  function removeTimeSlot(dayId: number, slot: string) {
    if (!settings) return;
    setDaySlots(dayId, daySlotsOf(settings, dayId).filter((s) => s !== slot));
  }

  /** One click: Monday–Friday 9 AM–8 PM, Saturday 1 PM–5 PM, Sunday closed. */
  function applyStudioHours() {
    if (!settings) return;
    setSettings({
      ...settings,
      bookingDays: [...DEFAULT_DAYS],
      bookingDaySlots: studioDaySlots(),
      bookingSlots: [...DEFAULT_SLOTS],
    });
    setScheduleNotice(`Studio hours applied (${studioHoursLabel()}, ${SLOT_INTERVAL_MINUTES}-minute appointments). Click Save all changes to publish them to customers.`);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      // Derive the legacy day list / flat slot list from the per-weekday grid so
      // the saved document is self-consistent for every client and the Worker.
      const bookingDays = (settings.bookingDays ?? [...DEFAULT_DAYS]).slice().sort((a, b) => a - b);
      const bookingDaySlots = Object.fromEntries(bookingDays.map((day) => [String(day), daySlotsOf(settings, day)]));
      const { slots: bookingSlots } = flattenDaySlots(bookingDaySlots);
      const next = await saveLocalPublicSettings({
        events: editableEvents(settings).map(event => Object.fromEntries(Object.entries(event).filter(([,value]) => value !== undefined)) as typeof event).sort((a,b) => a.eventDate.localeCompare(b.eventDate)),
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
        bookingDays,
        bookingSlots,
        bookingDaySlots,
        blockedDates: settings.blockedDates ?? [],
        blockedDateSlots: settings.blockedDateSlots ?? {},
        bookingNoticeDays: settings.bookingNoticeDays ?? 1,
      });
      setSettings(next);
      setScheduleNotice('');
      if (user) {
        await syncNow();
        setSavedMessage('Settings saved and synced live to customer websites!');
      } else {
        setSavedMessage('Settings saved locally! (Connect to Cloud in the bottom sync bar to sync to live customer websites.)');
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function manageAppointment(id: string, status: 'cancelled' | 'delete') {
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

  /**
   * Removes legacy requests that never proved payment (status missing or 'requested').
   * Documents marked 'confirmed' are never touched — they may be real promises.
   * After deleting, the staff must refresh the legacy slot safeguards so the
   * private D1 holds stop reserving slots for removed records.
   */
  async function deleteUnpaidRequests() {
    if (!user || bulkBusy) return;
    if (!window.confirm('Delete every legacy request still marked Pending (no payment proof)?\n\nRecords marked Confirmed are never touched. Refresh the legacy slot safeguards afterwards.')) return;
    setBulkBusy(true);
    setAppointmentError(null);
    setLegacyNotice('');
    try {
      const snap = await getDocs(query(collection(firestore, 'appointments'), limit(500)));
      const unpaid = snap.docs.filter((d) => String(d.data()['status'] ?? 'requested') === 'requested');
      let removed = 0;
      for (let i = 0; i < unpaid.length; i += 400) {
        const batch = writeBatch(firestore);
        for (const d of unpaid.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
        removed += Math.min(400, unpaid.length - i);
      }
      setLegacyNotice(removed === 0
        ? 'No unpaid legacy requests were left to delete.'
        : `Deleted ${removed} unpaid legacy request${removed === 1 ? '' : 's'}. Refresh the legacy slot safeguards so those slots can be booked online again.`);
    } catch (e) {
      setAppointmentError(e instanceof Error ? e.message : 'Could not delete unpaid requests.');
    } finally {
      setBulkBusy(false);
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
    <div className="p-6 sm:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Sticky action bar: live status and Save stay reachable while editing any panel. */}
      <div className="sticky top-0 z-20 -mx-2 px-2 pt-3 pb-2 backdrop-blur">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h1 className="font-bold text-2xl sm:text-3xl text-white tracking-tight">Studio settings</h1>
            <p className="text-body-xs text-zinc-400 mt-0.5">Availability, pop-ups, and the bookings customers pay for online.</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
              style={settings?.bookingEnabled === false
                ? { background: 'rgba(239,68,68,0.16)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }
                : { background: 'rgba(16,185,129,0.16)', color: '#34d399', border: '1px solid rgba(16,185,129,0.35)' }}
            >
              {settings?.bookingEnabled === false ? 'Bookings paused' : 'Booking live'}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !settings}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-ui-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
              style={{ background: 'var(--color-brand)', boxShadow: 'var(--shadow-brand)', border: 'none' }}
            >
              <Save size={15} />
              <span>{saving ? 'Saving…' : 'Save changes'}</span>
            </button>
          </div>
        </div>

        {/* One panel at a time — no more scrolling past four stacked cards. */}
        <nav aria-label="Settings sections" className="mt-3 flex flex-wrap gap-1.5 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => { setTab(t.id); window.history.replaceState(null, '', `#${ANCHORS[t.id]}`); }}
              className="px-3.5 py-2 rounded-xl text-body-xs font-bold transition-colors"
              style={tab === t.id ? { background: 'var(--color-brand)', color: '#fff' } : { background: 'transparent', color: 'var(--color-text-muted)' }}
            >
              {t.label}
            </button>
          ))}
        </nav>
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
          <span>{savedMessage}</span>
        </div>
      )}

      <div className={tab === 'bookings' ? 'space-y-6' : 'hidden'}>
        <PaidBookingsView />
      </div>

      {/* ════ PANEL 1: PUBLIC BOOKING & SCHEDULE CONTROLS ════ */}
      <section id="booking-schedule" style={cardStyle} className={`p-6 space-y-6${tab === 'schedule' ? '' : ' hidden'}`}>
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

        {settings && <DateAvailabilityEditor settings={settings} onChange={changes => setSettings(current => current ? { ...current, ...changes } : current)} />}

        {/* Allowed Days of Week */}
        <div className="space-y-2">
          <label className="text-body-xs font-bold text-zinc-300 uppercase tracking-wider block">
            Allowed Booking Days
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((d) => {
              const isChecked = (settings?.bookingDays ?? DEFAULT_DAYS).includes(d.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDay(d.id)}
                  aria-pressed={isChecked}
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

        {/* Studio Hours & Per-Weekday Slot Manager */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <label className="text-body-xs font-bold text-zinc-300 uppercase tracking-wider block">
                Studio Hours &amp; Appointment Slots
              </label>
              <p className="text-body-xs text-zinc-400">
                {studioHoursLabel()} · {SLOT_INTERVAL_MINUTES}-minute appointments
              </p>
              <p
                className="text-body-xs font-semibold"
                style={{ color: matchesStudioHours(settings) ? 'var(--color-success-text)' : 'var(--color-warn-text)' }}
              >
                {matchesStudioHours(settings)
                  ? 'Weekly schedule matches the studio hours above.'
                  : 'Custom weekly schedule. Apply studio hours to reset the week; your date exceptions stay in place.'}
              </p>
            </div>
            <button
              type="button"
              onClick={applyStudioHours}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-body-xs font-bold text-white"
              style={{ background: 'var(--color-brand)' }}
            >
              <CalendarCheck size={14} /> Apply studio hours
            </button>
          </div>

          <p className="text-body-xs text-zinc-400">These times repeat every week. Lunch is always 12–1 PM. The last weekday booking is 7:45–8:30 PM; Saturday is 4:45–5:30 PM, so every appointment gets 45 minutes.</p>

          {scheduleNotice && (
            <p role="status" className="text-body-xs font-semibold" style={{ color: 'var(--color-warn-text)' }}>{scheduleNotice}</p>
          )}

          <div className="space-y-2">
            {DAYS_OF_WEEK.map((d) => {
              const enabled = (settings?.bookingDays ?? DEFAULT_DAYS).includes(d.id);
              const slots = daySlotsOf(settings, d.id);
              return (
                <div
                  key={d.id}
                  className="rounded-2xl p-3 space-y-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-xs font-bold text-white">{d.full}</span>
                    <span className="text-[11px] text-zinc-400 text-right">
                      {!enabled
                        ? 'Not bookable — switch the day on above'
                        : slots.length === 0
                        ? 'No slots — this day cannot be booked'
                        : `${slotRangesLabel(slots)} · ${slots.length} slots`}
                    </span>
                  </div>

                  {enabled && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        {slots.map((slot) => (
                          <span
                            key={slot}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-body-xs font-bold bg-zinc-800/80 border border-zinc-700 text-white"
                          >
                            <Clock size={12} className="text-violet-400" />
                            <span>{format12Hour(slot)}</span>
                            <button
                              type="button"
                              onClick={() => removeTimeSlot(d.id, slot)}
                              className="p-0.5 hover:text-red-400 transition-colors"
                              title={`Remove ${format12Hour(slot)} from ${d.full}`}
                            >
                              <XCircle size={14} />
                            </button>
                          </span>
                        ))}
                        {slots.length === 0 && (
                          <p className="text-body-xs text-zinc-500">Add a slot to reopen this day.</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="time"
                          aria-label={`Add time for ${d.full}`}
                          value={newSlotInputs[d.id] ?? ''}
                          onChange={(e) => setNewSlotInputs(inputs => ({ ...inputs, [d.id]: e.target.value }))}
                          className="p-2 rounded-xl text-body-xs text-white bg-zinc-800/60 border border-zinc-700 flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => addTimeSlot(d.id)}
                          disabled={!newSlotInputs[d.id]}
                          className="px-3 py-2 rounded-xl text-body-xs font-bold bg-violet-600 text-white disabled:opacity-40"
                        >
                          <Plus size={14} className="inline mr-1" /> Add
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </section>

      {/* ════ SECTION 2: POP-UP EVENT & HOME STUDIO PROFILE ════ */}
      <section id="popup-event" style={cardStyle} className={`p-6 space-y-5${tab === 'popups' ? '' : ' hidden'}`}>
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-600/20 text-amber-400">
            <Megaphone size={18} />
          </div>
          <div>
            <h2 className="font-bold text-body text-white">Pop-Up Events &amp; Studio Profile</h2>
            <p className="text-body-xs text-zinc-400">Shown on /popup.html, /live.html, and the home page</p>
          </div>
        </div>

        <p className="text-sm text-zinc-400">Add up to 12 events. One venue per day; use a date range for consecutive days at the same venue. Hours apply each day. Overlapping ranges cannot be saved. Published upcoming dates appear in order; past dates disappear from the public schedule. Save all changes to apply. Published pop-ups automatically block studio bookings for every day in their date range. Use blackout dates above for other closures. Existing paid bookings must be reviewed separately.</p>
        {editableEvents(settings).map((event, index) => <fieldset key={event.id} className="rounded-2xl border border-zinc-700 p-4 space-y-4">
          <legend className="px-2 font-semibold">Event {index + 1}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {([['eventTitle','Event title'],['eventDate','Start date'],['eventEndDate','End date (same day if blank)'],['eventHours','Operating hours'],['eventLocation','Venue'],['eventMapUrl','Maps link']] as const).map(([key,label]) => <label key={key} className="block text-sm"><span className="block mb-1 text-zinc-400">{label}</span><input style={inputStyle} type={(key === 'eventDate' || key === 'eventEndDate') ? 'date' : key === 'eventMapUrl' ? 'url' : 'text'} value={event[key] ?? ''} onChange={e => patch('events', editableEvents(settings).map(item => item.id === event.id ? {...item, [key]: key === 'eventEndDate' ? (e.target.value || undefined) : e.target.value} : item))} /></label>)}
          </div>
          <div className="flex flex-wrap justify-between gap-3"><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={event.eventActive} onChange={e => patch('events', editableEvents(settings).map(item => item.id === event.id ? {...item, eventActive:e.target.checked} : item))} />Publish this event</label><button type="button" className="text-sm text-red-300 underline" onClick={() => patch('events', editableEvents(settings).filter(item => item.id !== event.id))}>Remove event {index + 1}</button></div>
        </fieldset>)}
        {editableEvents(settings).length === 0 && <p className="text-zinc-400">No events scheduled. Add your next pop-up below.</p>}
        <button type="button" disabled={editableEvents(settings).length >= 12} className="rounded-xl bg-violet-600 px-4 py-2 font-semibold disabled:opacity-40" onClick={() => patch('events', [...editableEvents(settings), {id:crypto.randomUUID(),eventDate:'',eventTitle:'',eventHours:'',eventLocation:'',eventMapUrl:'',eventActive:false}])}>Add pop-up event</button>

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

      {/* ════ PANEL 3: INCOMING BOOKING REQUESTS ════ */}
      <section id="incoming-requests" style={cardStyle} className={`p-6 space-y-5${tab === 'legacy' ? '' : ' hidden'}`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-600/20 text-emerald-400">
              <CalendarCheck size={18} />
            </div>
            <div>
              <h2 className="font-bold text-body text-white">Legacy appointment requests</h2>
              <p className="text-xs text-amber-300">Pre-payment records. They do not prove payment, and future ones hold their slot through the private safeguards — not through a deposit.</p>
              <p className="text-body-xs text-zinc-400">Review, cancel or delete them, then refresh the legacy slot safeguards so the freed slots can be booked online again.</p>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
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

        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {user && <button type="button" onClick={() => void deleteUnpaidRequests()} disabled={bulkBusy} className="self-start rounded-xl px-3.5 py-2 text-body-xs font-bold" style={{ background: 'rgba(239,68,68,0.16)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.35)', opacity: bulkBusy ? 0.6 : 1 }}>{bulkBusy ? 'Deleting unpaid requests…' : 'Delete unpaid requests'}</button>}
          <p className="text-body-xs text-zinc-500">Removes every record still marked Pending (no payment proof). Confirmed records are never touched. Run “Import / refresh legacy slot safeguards” afterwards.</p>
        </div>

        {legacyNotice && <p role="status" className="rounded-xl p-3 text-body-xs" style={{ background: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: '1px solid rgba(16,185,129,0.3)' }}>{legacyNotice}</p>}

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
          <div role="region" aria-label="Legacy appointment requests" tabIndex={0} className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto pr-1">
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
