import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { PublicSettings, BookingSelectedPiercing } from '../types';
import { UPGRADES } from '../constants';
import { PublicShell } from './PublicShell';
import { EarDiagram } from './booking/EarDiagram';
import { FaceDiagram } from './booking/FaceDiagram';
import { BodyDiagram } from './booking/BodyDiagram';
import { PiercingSpotModal } from './booking/PiercingSpotModal';
import { BookingCartBar } from './booking/BookingCartBar';
import {
  EAR_HOTSPOTS,
  FACE_HOTSPOTS,
  BODY_HOTSPOTS,
  type PiercingHotspot,
} from './booking/types';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Send,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Layers,
  ListFilter,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { validAppointmentDate } from '../validation';

type VisualCategory = 'EAR' | 'FACE' | 'BODY' | 'CUSTOM';
type ViewMode = 'diagram' | 'list';

const DEFAULT_SLOTS = ['13:00', '14:30', '16:00', '17:30', '19:00'];
const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 0]; // All days

function format12Hour(time24: string): string {
  const [h, m] = time24.split(':').map(Number);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m < 10 ? '0' + m : m} ${ampm}`;
}

export function AppointmentPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedPiercings, setSelectedPiercings] = useState<BookingSelectedPiercing[]>([]);
  const [activeCategory, setActiveCategory] = useState<VisualCategory>('EAR');
  const [viewMode, setViewMode] = useState<ViewMode>('diagram');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeModalSpot, setActiveModalSpot] = useState<{
    spot: PiercingHotspot;
    side?: 'left' | 'right';
  } | null>(null);

  // Custom Piercing Form State
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'EAR' | 'FACE' | 'BODY' | 'ORAL' | 'CUSTOM'>('EAR');
  const [customSide, setCustomSide] = useState<'left' | 'right' | 'both' | 'none'>('none');
  const [customPrice] = useState(350);
  const [customUpgrade, setCustomUpgrade] = useState<number>(0);
  const [customNotes, setCustomNotes] = useState('');
  const [customAddedFlash, setCustomAddedFlash] = useState(false);

  // Public Settings from Firestore
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);

  // Step 2: Schedule State
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  // Step 3: Client Info & Submission
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pending = useRef(false);
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    const unsub = onSnapshot(
      doc(firestore, 'public', 'public'),
      (snap) => {
        setPublicSettings(snap.exists() ? (snap.data() as PublicSettings) : null);
      },
      () => setPublicSettings(null)
    );
    return unsub;
  }, []);

  const bookingEnabled = publicSettings?.bookingEnabled !== false;
  const allowedDays = publicSettings?.bookingDays && publicSettings.bookingDays.length > 0
    ? publicSettings.bookingDays
    : DEFAULT_DAYS;
  const availableSlots = publicSettings?.bookingSlots && publicSettings.bookingSlots.length > 0
    ? publicSettings.bookingSlots
    : DEFAULT_SLOTS;
  const blockedDates = new Set(publicSettings?.blockedDates ?? []);

  // Compute total estimate
  const totalEstimate = selectedPiercings.reduce(
    (sum, p) => sum + p.basePrice + (p.upgradePrice ?? 0),
    0
  );

  // Hotspot selection handlers
  function handleSelectSpot(spot: PiercingHotspot, side?: 'left' | 'right') {
    setActiveModalSpot({ spot, side });
  }

  function handleAddPiercing(item: BookingSelectedPiercing) {
    setSelectedPiercings((prev) => {
      const idx = prev.findIndex((p) => p.name === item.name && p.side === item.side);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
  }

  function handleRemovePiercing(id: string) {
    setSelectedPiercings((prev) => prev.filter((p) => p.id !== id));
  }

  function handleAddCustomPiercing() {
    const trimmed = customName.trim();
    if (!trimmed) return;
    const upgradeObj = UPGRADES.find((u) => u.price === customUpgrade) ?? UPGRADES[0];
    const sideMultiplier = customSide === 'both' ? 2 : 1;
    const item: BookingSelectedPiercing = {
      id: crypto.randomUUID(),
      name: trimmed,
      category: customCategory,
      basePrice: customPrice * sideMultiplier,
      upgradeLabel: upgradeObj.price > 0 ? upgradeObj.label : undefined,
      upgradePrice: upgradeObj.price > 0 ? upgradeObj.price * sideMultiplier : undefined,
      side: customSide !== 'none' ? customSide : undefined,
      isCustom: true,
      customNotes: customNotes.trim() || undefined,
    };
    handleAddPiercing(item);
    setCustomName('');
    setCustomNotes('');
    setCustomAddedFlash(true);
    setTimeout(() => setCustomAddedFlash(false), 2500);
  }

  const ALL_HOTSPOTS = [...EAR_HOTSPOTS, ...FACE_HOTSPOTS, ...BODY_HOTSPOTS];
  const isSearching = searchQuery.trim().length > 0;
  const displayHotspots = isSearching
    ? ALL_HOTSPOTS.filter(
        (spot) =>
          spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          spot.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          spot.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeCategory === 'EAR'
    ? EAR_HOTSPOTS
    : activeCategory === 'FACE'
    ? FACE_HOTSPOTS
    : BODY_HOTSPOTS;

  // Submission handler
  async function handleSubmitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    if (!name.trim() || !contact.trim()) {
      setError('Please enter your name and contact info.');
      return;
    }
    if (!date || !time || !validAppointmentDate(date, time)) {
      setError('Please select a valid future date and time slot.');
      return;
    }
    if (!waiverAgreed) {
      setError('Please review and accept the studio safety guidelines.');
      setShowWaiverModal(true);
      return;
    }

    pending.current = true;
    setBusy(true);
    setError(null);

    try {
      // Build clean structured notes with piercings breakdown
      const itemsBreakdown = selectedPiercings.length > 0
        ? `[Piercings: ${selectedPiercings
            .map(
              (p) =>
                `${p.name}${p.side ? ` (${p.side})` : ''}${
                  p.upgradePrice ? ` + ${p.upgradeLabel}` : ''
                } - ₱${p.basePrice + (p.upgradePrice ?? 0)}`
            )
            .join(', ')} | Est: ₱${totalEstimate}]`
        : '[No specific piercings pre-selected]';

      const fullNotes = notes.trim()
        ? `${itemsBreakdown} Note: ${notes.trim()}`
        : itemsBreakdown;

      // Truncate to 300 chars to strictly satisfy Firestore rules
      const safeNotes = fullNotes.slice(0, 300);

      await setDoc(doc(firestore, 'appointments', requestId.current), {
        name: name.trim(),
        contact: contact.trim(),
        date: date.trim(),
        time: time.trim(),
        notes: safeNotes,
        status: 'requested',
        createdAt: serverTimestamp(),
        requestedFor: Date.parse(`${date}T${time}:00+08:00`),
      });

      setDone(true);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code.includes('permission-denied')) {
        setError('The request could not be accepted. Please contact the studio directly on Instagram.');
      } else {
        setError('Could not save your request. Please check your internet connection and try again.');
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  // Helper to generate the next 21 selectable days
  const upcomingDays = (() => {
    const days: { dateStr: string; label: string; dayName: string; dayNum: number; available: boolean }[] = [];
    const now = new Date();
    const minNotice = publicSettings?.bookingNoticeDays ?? 1;

    for (let i = minNotice; i <= 21; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

      const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon ...
      const isAllowedDay = allowedDays.includes(dayOfWeek);
      const isBlocked = blockedDates.has(dateStr);

      days.push({
        dateStr,
        label: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
        dayName: d.toLocaleDateString('en-PH', { weekday: 'short' }),
        dayNum: d.getDate(),
        available: isAllowedDay && !isBlocked,
      });
    }
    return days;
  })();

  const selectedNames = selectedPiercings.map((p) => p.name);

  return (
    <PublicShell page="appointment">
      <div className="space-y-6 pb-20 sm:pb-12">
        {/* Page Header */}
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--color-brand-text)' }}>
            PRIVATE HOME STUDIO
          </p>
          <h1 className="font-bold text-3xl sm:text-4xl text-white tracking-tight leading-tight">
            BOOK AN APPOINTMENT
          </h1>
          <p className="text-body-xs sm:text-body-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Pick your desired piercing placements, select an available date &amp; time, and confirm your booking.
          </p>
        </div>

        {!bookingEnabled ? (
          /* Bookings paused notification */
          <div
            className="rounded-3xl p-6 sm:p-8 text-center space-y-3"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div
              className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(217,119,6,0.15)', color: 'var(--color-warn-text)' }}
            >
              <Clock size={24} />
            </div>
            <h2 className="font-bold text-lg text-white">Online Bookings Temporarily Closed</h2>
            <p className="text-body-xs text-zinc-400 max-w-sm mx-auto">
              We are currently not accepting new automated bookings. Please message us directly on Instagram for private appointment inquiries.
            </p>
            <a
              href="https://www.instagram.com/punkture_studios/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-body-xs font-bold text-white mt-2"
              style={{ background: 'var(--color-brand)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              Message @punkture_studios ↗
            </a>
          </div>
        ) : done ? (
          /* Confirmation / Success Screen */
          <div
            className="rounded-3xl p-6 sm:p-8 text-center space-y-4"
            style={{
              background: 'radial-gradient(circle at 50% 0%, rgba(16,185,129,0.15) 0%, rgba(17,21,32,0.95) 70%)',
              border: '1px solid rgba(52,211,153,0.3)',
            }}
          >
            <CheckCircle2 size={44} className="mx-auto text-emerald-400" />
            <div className="space-y-1">
              <h2 className="font-bold text-3xl text-white tracking-tight">Booking Request Received!</h2>
              <p className="text-body-xs text-zinc-300">
                Thank you, <span className="font-bold text-white">{name.trim().split(' ')[0]}</span>! We will confirm your session through{' '}
                <span className="font-bold text-emerald-300">{contact.trim()}</span>.
              </p>
            </div>

            {/* Request Summary Card */}
            <div
              className="rounded-2xl p-4 text-left space-y-2.5 mx-auto max-w-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)' }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-body-xs">
                <span className="text-zinc-400">Date &amp; Time:</span>
                <span className="font-mono font-bold text-white">
                  {date} · {format12Hour(time)}
                </span>
              </div>
              {selectedPiercings.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Requested Piercings ({selectedPiercings.length}):
                  </span>
                  {selectedPiercings.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-body-xs text-zinc-200">
                      <span>
                        {p.name} {p.side ? `(${p.side})` : ''}
                      </span>
                      <span className="font-mono text-zinc-400">
                        ₱{p.basePrice + (p.upgradePrice ?? 0)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between font-bold text-white">
                    <span>Est. Total:</span>
                    <span className="font-mono text-emerald-400">₱{totalEstimate}</span>
                  </div>
                </div>
              )}
            </div>

            <a
              href="/home.html"
              className="inline-block px-6 py-3 rounded-2xl text-ui font-bold text-white transition-transform active:scale-95"
              style={{ background: 'var(--color-brand)', textDecoration: 'none' }}
            >
              Done
            </a>
          </div>
        ) : (
          /* Multi-step Booking Form */
          <div className="space-y-6">
            {/* Booking Process Stepper */}
            <div
              className="rounded-3xl p-4 sm:p-5 space-y-3"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--color-border)',
              }}
            >
              {/* Stepper Header / Current Status */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">
                    Booking Flow
                  </span>
                  <span className="text-body-xs font-bold text-white">
                    {step === 1 ? 'Step 1: Choose Piercings' : step === 2 ? 'Step 2: Pick Schedule' : 'Step 3: Client Details'}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-zinc-400">
                  {step}/3
                </span>
              </div>

              {/* Connected Step Track */}
              {/*
                Layout math:
                - 3 steps each take flex:1 = 33.33% of container width
                - Circle center of step 1 is at 33.33%/2 = 16.67% from left
                - Circle center of step 3 is at 100% - 16.67% = 83.33% from left
                - So the track line runs left:16.67% → right:16.67%
                - Items-start ensures circles all start at the same top, so
                  top-5 (20px = half of h-10 circle) hits perfectly center
              */}
              <div className="relative flex items-start justify-between">
                {/* Background track line — anchored from circle center to circle center */}
                <div
                  className="absolute top-5 h-0.5 pointer-events-none"
                  style={{
                    left: '16.67%',
                    right: '16.67%',
                    background: 'rgba(255,255,255,0.08)',
                  }}
                />
                {/* Active track fill — grows from left circle center */}
                <div
                  className="absolute top-5 h-0.5 pointer-events-none transition-all duration-500"
                  style={{
                    left: '16.67%',
                    // 0% at step 1 → 50% of track at step 2 → 100% of track at step 3
                    // Track total width = 83.33% - 16.67% = 66.66% of container
                    width: step === 1
                      ? '0%'
                      : step === 2
                      ? '33.33%'            // half of 66.66% track
                      : '66.66%',           // full track
                    background: 'linear-gradient(90deg, #10b981, #8b5cf6)',
                  }}
                />

                {[
                  {
                    num: 1,
                    title: '1. Select Piercings',
                    sub: selectedPiercings.length > 0 ? `${selectedPiercings.length} selected` : 'Pick spots',
                  },
                  {
                    num: 2,
                    title: '2. Pick Schedule',
                    sub: 'Date & time',
                  },
                  {
                    num: 3,
                    title: '3. Your Details',
                    sub: 'Contact & confirm',
                  },
                ].map((s) => {
                  const isCompleted = step > s.num;
                  const isActive = step === s.num;
                  const canClick =
                    s.num < step ||
                    (s.num === 2 && selectedPiercings.length > 0) ||
                    (s.num === 3 && date && time);

                  return (
                    <button
                      key={s.num}
                      type="button"
                      disabled={!canClick && !isActive}
                      onClick={() => {
                        if (canClick) setStep(s.num as 1 | 2 | 3);
                      }}
                      className={`relative z-10 flex flex-col items-center text-center transition-all ${
                        canClick || isActive ? 'cursor-pointer' : 'cursor-default opacity-50'
                      }`}
                      style={{ flex: 1 }}
                    >
                      {/* Step Circle Indicator */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-xs transition-all"
                        style={{
                          background: isCompleted
                            ? '#10b981'
                            : isActive
                            ? 'var(--color-brand)'
                            : 'var(--color-surface)',
                          color: isCompleted || isActive ? '#fff' : 'var(--color-text-muted)',
                          border: isCompleted
                            ? '2px solid #34d399'
                            : isActive
                            ? '2px solid #c4b5fd'
                            : '2px solid rgba(255,255,255,0.18)',
                          boxShadow: isActive
                            ? '0 0 16px rgba(139,92,246,0.6)'
                            : isCompleted
                            ? '0 0 10px rgba(16,185,129,0.35)'
                            : 'none',
                        }}
                      >
                        {isCompleted ? <CheckCircle2 size={18} /> : s.num}
                      </div>

                      {/* Step Title & Subtitle */}
                      <div className="mt-2 px-1">
                        <span
                          className="text-[12px] sm:text-body-xs font-bold block leading-tight"
                          style={{
                            color: isActive
                              ? '#fff'
                              : isCompleted
                              ? 'var(--color-success-text)'
                              : 'var(--color-text-muted)',
                          }}
                        >
                          {s.title}
                        </span>
                        <span
                          className="text-[10px] sm:text-[11px] block mt-0.5 leading-tight truncate max-w-[95px] sm:max-w-none"
                          style={{
                            color: isCompleted
                              ? 'var(--color-success-text)'
                              : isActive
                              ? 'var(--color-brand-text)'
                              : 'var(--color-text-faint)',
                            fontWeight: isCompleted || isActive ? 600 : 400,
                          }}
                        >
                          {s.sub}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>

            {/* ════ STEP 1: PIERCING PLACEMENT PICKER ════ */}
            {step === 1 && (
              <div className="space-y-4">
                {/* Category Switcher - Modern typography, NO emojis */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('EAR');
                      setSearchQuery('');
                      setViewMode('diagram');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl text-ui-sm font-bold transition-all flex items-center justify-center whitespace-nowrap"
                    style={{
                      background: activeCategory === 'EAR' && !isSearching ? 'var(--color-brand)' : 'transparent',
                      color: activeCategory === 'EAR' && !isSearching ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    Ear
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('FACE');
                      setSearchQuery('');
                      setViewMode('diagram');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl text-ui-sm font-bold transition-all flex items-center justify-center whitespace-nowrap"
                    style={{
                      background: activeCategory === 'FACE' && !isSearching ? 'var(--color-brand)' : 'transparent',
                      color: activeCategory === 'FACE' && !isSearching ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    Face &amp; Oral
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('BODY');
                      setSearchQuery('');
                      setViewMode('diagram');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl text-ui-sm font-bold transition-all flex items-center justify-center whitespace-nowrap"
                    style={{
                      background: activeCategory === 'BODY' && !isSearching ? 'var(--color-brand)' : 'transparent',
                      color: activeCategory === 'BODY' && !isSearching ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    Body
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory('CUSTOM');
                      setSearchQuery('');
                      setViewMode('diagram');
                    }}
                    className="flex-1 py-2.5 px-3 rounded-xl text-ui-sm font-bold transition-all flex items-center justify-center whitespace-nowrap"
                    style={{
                      background: activeCategory === 'CUSTOM' && !isSearching ? 'var(--color-brand)' : 'transparent',
                      color: activeCategory === 'CUSTOM' && !isSearching ? '#fff' : 'var(--color-text-muted)',
                    }}
                  >
                    Custom Piercing
                  </button>
                </div>

                {/* Search Bar - auto switches to list when typed, restores on exit/clear/escape */}
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (val.trim()) {
                        setViewMode('list');
                      } else {
                        setViewMode('diagram');
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setSearchQuery('');
                        setViewMode('diagram');
                      }
                    }}
                    placeholder="Search piercing by name or placement (e.g. Helix, Septum, Navel, Conch)..."
                    className="w-full pl-10 pr-10 py-3 rounded-2xl text-body-xs text-white placeholder-zinc-500 transition-all focus:ring-1 focus:ring-violet-500"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: isSearching ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setViewMode('diagram');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-zinc-400 hover:text-white bg-white/5 transition-colors"
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* View Mode Toggle & Anatomy Advisory (when not in custom mode and not searching) */}
                {activeCategory !== 'CUSTOM' && !isSearching && (
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                    {/* Segmented Graphic vs List toggle */}
                    <div
                      className="inline-flex items-center p-1 rounded-xl mx-auto sm:mx-0"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
                    >
                      <button
                        type="button"
                        onClick={() => setViewMode('diagram')}
                        className="px-3.5 py-1.5 rounded-lg text-body-xs font-bold transition-all flex items-center gap-1.5"
                        style={{
                          background: viewMode === 'diagram' ? 'var(--color-brand)' : 'transparent',
                          color: viewMode === 'diagram' ? '#fff' : 'var(--color-text-muted)',
                        }}
                      >
                        <Layers size={13} />
                        <span>Graphic Map</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        className="px-3.5 py-1.5 rounded-lg text-body-xs font-bold transition-all flex items-center gap-1.5"
                        style={{
                          background: viewMode === 'list' ? 'var(--color-brand)' : 'transparent',
                          color: viewMode === 'list' ? '#fff' : 'var(--color-text-muted)',
                        }}
                      >
                        <ListFilter size={13} />
                        <span>List Directory</span>
                      </button>
                    </div>

                    {/* General anatomy advisory note */}
                    <span className="text-[11px] text-amber-300/90 font-medium flex items-center gap-1 mx-auto sm:mx-0">
                      <AlertTriangle size={12} className="text-amber-400" />
                      Anatomy suitability assessed during appointment
                    </span>
                  </div>
                )}

                {/* Search Feedback Header */}
                {isSearching && (
                  <div className="flex items-center justify-between text-body-xs text-zinc-400 px-1">
                    <span>
                      Found <span className="text-white font-bold">{displayHotspots.length}</span> matching piercings for <span className="text-violet-300 font-bold">"{searchQuery}"</span>:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setViewMode('diagram');
                      }}
                      className="text-violet-400 hover:underline text-[11px] font-semibold"
                    >
                      Exit search ✕
                    </button>
                  </div>
                )}

                {/* RENDER: Graphic Diagram View (when not searching and diagram mode is active) */}
                {viewMode === 'diagram' && !isSearching && activeCategory !== 'CUSTOM' && (
                  <div className="flex flex-col items-center pt-2">
                    {activeCategory === 'EAR' && (
                      <EarDiagram
                        selectedNames={selectedNames}
                        onSelectSpot={(spot) => handleSelectSpot(spot)}
                      />
                    )}
                    {activeCategory === 'FACE' && (
                      <FaceDiagram
                        selectedNames={selectedNames}
                        onSelectSpot={(spot) => handleSelectSpot(spot)}
                      />
                    )}
                    {activeCategory === 'BODY' && (
                      <BodyDiagram
                        selectedNames={selectedNames}
                        onSelectSpot={(spot) => handleSelectSpot(spot)}
                      />
                    )}
                  </div>
                )}

                {/* RENDER: List Directory View (either by mode or during live search) */}
                {(viewMode === 'list' || isSearching) && activeCategory !== 'CUSTOM' && (
                  <div className="w-full space-y-2">
                    {displayHotspots.map((spot) => {
                      const isSelected = selectedNames.includes(spot.name);
                      return (
                        <div
                          key={spot.id}
                          onClick={() => handleSelectSpot(spot)}
                          className="px-4 py-3 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-white/5"
                          style={{
                            background: isSelected ? 'rgba(16,185,129,0.08)' : 'var(--color-surface)',
                            border: isSelected ? '1px solid rgba(52,211,153,0.5)' : '1px solid var(--color-border)',
                          }}
                        >
                          {/* Left: name + badges */}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-white text-body">{spot.name}</span>
                              <span className="text-[10px] uppercase font-bold text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800/80">
                                {spot.category}
                              </span>
                              {spot.anatomyDependent && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                  Anatomy Dependent
                                </span>
                              )}
                              {isSelected && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                                  Selected
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: price + button */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-mono font-bold text-violet-300 text-body-sm">
                              ₱{spot.basePrice}
                            </span>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-transform active:scale-95"
                              style={{
                                background: isSelected ? '#10b981' : 'var(--color-brand)',
                                color: '#fff',
                              }}
                            >
                              {isSelected ? (
                                <>
                                  <CheckCircle2 size={12} />
                                  <span>Edit</span>
                                </>
                              ) : (
                                <>
                                  <Plus size={12} />
                                  <span>View &amp; Add</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {displayHotspots.length === 0 && isSearching && (
                      <div
                        className="p-8 text-center rounded-2xl space-y-2"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}
                      >
                        <p className="text-zinc-400 text-body-xs">No matching piercings found for "{searchQuery}".</p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setActiveCategory('CUSTOM');
                          }}
                          className="text-xs font-bold text-violet-400 hover:underline"
                        >
                          Request a custom piercing instead →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* RENDER: Custom Piercing Tab */}
                {activeCategory === 'CUSTOM' && (
                  <div
                    className="w-full rounded-3xl p-5 sm:p-6 space-y-4"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                          Personalized Request
                        </span>
                        <h3 className="font-bold text-xl text-white tracking-tight">
                          Custom Piercing or Curation Project
                        </h3>
                        <p className="text-body-xs text-zinc-400 mt-1">
                          Have a unique placement in mind, stacked lobe, or custom curations? Type your request below.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-2xl bg-violet-500/10 text-violet-400">
                        <Sparkles size={20} />
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      {/* Placement Name */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Placement Name or Project Title *
                        </label>
                        <input
                          type="text"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          placeholder="e.g. Stacked Upper Lobe, Surface Tragus, Snake Eyes, Dermal Anchor"
                          className="w-full px-4 py-3 rounded-xl text-body-sm text-white"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
                        />
                      </div>

                      {/* Target Anatomy Area */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Anatomy Area
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['EAR', 'FACE', 'BODY', 'ORAL'] as const).map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setCustomCategory(cat)}
                              className="py-2 px-2 rounded-xl text-body-xs font-bold transition-all text-center"
                              style={{
                                background: customCategory === cat ? 'var(--color-brand)' : 'rgba(255,255,255,0.04)',
                                color: customCategory === cat ? '#fff' : 'var(--color-text-muted)',
                                border: customCategory === cat ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                              }}
                            >
                              {cat === 'EAR' ? 'Ear' : cat === 'FACE' ? 'Face' : cat === 'BODY' ? 'Body' : 'Oral'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Side Selector */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Placement Side (Optional)
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(
                            [
                              { id: 'none', label: 'N/A · Center' },
                              { id: 'left', label: 'Left' },
                              { id: 'right', label: 'Right' },
                              { id: 'both', label: 'Both (2×)' },
                            ] as const
                          ).map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setCustomSide(s.id)}
                              className="py-2 px-1 rounded-xl text-[11px] font-bold transition-all text-center truncate"
                              style={{
                                background: customSide === s.id ? 'var(--color-brand)' : 'rgba(255,255,255,0.04)',
                                color: customSide === s.id ? '#fff' : 'var(--color-text-muted)',
                                border: customSide === s.id ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                              }}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Jewelry Material */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Initial Jewelry Material
                        </label>
                        <div className="space-y-1.5">
                          {UPGRADES.map((u) => {
                            const isSelected = customUpgrade === u.price;
                            return (
                              <button
                                key={u.price}
                                type="button"
                                onClick={() => setCustomUpgrade(u.price)}
                                className="w-full flex items-center justify-between p-2.5 rounded-xl text-body-xs font-semibold transition-all text-left"
                                style={{
                                  background: isSelected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.03)',
                                  border: isSelected ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                                  color: isSelected ? '#fff' : 'var(--color-text-muted)',
                                }}
                              >
                                <span>{u.label}</span>
                                <span className="font-mono font-bold">
                                  {u.price === 0 ? 'Included' : `+₱${u.price}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Placement Details / Description */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Notes / Anatomy Specifics (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={customNotes}
                          onChange={(e) => setCustomNotes(e.target.value)}
                          placeholder="e.g. Squeezing a third lobe between existing holes; checking if industrial bar fits my scapha."
                          className="w-full px-4 py-2.5 rounded-xl text-body-xs text-white"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
                        />
                      </div>

                      {/* Anatomy Reminder Note */}
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-body-xs text-amber-200">
                        <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-400" />
                        <p className="text-[11px] leading-relaxed">
                          <strong>Anatomy Consultation:</strong> Custom or unusual placements require in-person tissue evaluation. Starting estimate is ₱{customPrice * (customSide === 'both' ? 2 : 1)} (final price confirmed before piercing).
                        </p>
                      </div>

                      {/* Add Custom Button */}
                      <button
                        type="button"
                        disabled={!customName.trim()}
                        onClick={handleAddCustomPiercing}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-ui-sm transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: customAddedFlash ? 'var(--color-success)' : 'var(--color-brand)',
                          color: '#fff',
                          boxShadow: 'var(--shadow-brand)',
                        }}
                      >
                        {customAddedFlash ? (
                          <>
                            <CheckCircle2 size={16} />
                            <span>Added to Session Cart!</span>
                          </>
                        ) : (
                          <>
                            <Plus size={16} />
                            <span>Add Custom Piercing (₱{customPrice * (customSide === 'both' ? 2 : 1) + customUpgrade * (customSide === 'both' ? 2 : 1)})</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Skip / Direct Next if user already knows what they want */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-body-xs font-semibold text-zinc-400 hover:text-white underline underline-offset-4"
                  >
                    {selectedPiercings.length > 0
                      ? 'Continue with chosen piercings →'
                      : 'Skip placement selection & proceed to schedule →'}
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 2: PICK SCHEDULE & TIME SLOTS ════ */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-body text-white flex items-center gap-2">
                    <CalendarIcon size={18} className="text-violet-400" />
                    1. Select an Available Date
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-body-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <ChevronLeft size={14} /> Back to Piercings
                  </button>
                </div>

                {/* Available Date Chips / Horizontal Picker */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {upcomingDays.map((day) => {
                    const isSelected = date === day.dateStr;
                    return (
                      <button
                        key={day.dateStr}
                        type="button"
                        disabled={!day.available}
                        onClick={() => {
                          setDate(day.dateStr);
                        }}
                        className={`p-3 rounded-2xl flex flex-col items-center justify-center transition-all ${
                          !day.available ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        style={{
                          background: isSelected ? 'var(--color-brand)' : 'var(--color-surface)',
                          border: isSelected ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                          color: isSelected ? '#fff' : 'var(--color-text)',
                        }}
                      >
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {day.dayName}
                        </span>
                        <span className="text-lg font-black font-mono leading-tight">
                          {day.dayNum}
                        </span>
                        <span className="text-[10px] text-zinc-400">{day.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Time Slots */}
                {date && (
                  <div className="space-y-3 pt-3 border-t border-zinc-800">
                    <h2 className="font-bold text-body text-white flex items-center gap-2">
                      <Clock size={18} className="text-violet-400" />
                      2. Choose a Time Slot
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {availableSlots.map((slot) => {
                        const isSelected = time === slot;
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => setTime(slot)}
                            className="py-3 px-4 rounded-xl font-mono font-bold text-ui-sm text-center transition-all"
                            style={{
                              background: isSelected ? 'var(--color-brand)' : 'rgba(255,255,255,0.04)',
                              border: isSelected ? '1px solid var(--color-brand-light)' : '1px solid var(--color-border)',
                              color: isSelected ? '#fff' : 'var(--color-text)',
                            }}
                          >
                            {format12Hour(slot)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Step 2 Action Button */}
                <div className="pt-3">
                  <button
                    type="button"
                    disabled={!date || !time}
                    onClick={() => setStep(3)}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-ui text-white transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'var(--color-brand)', boxShadow: 'var(--shadow-brand)' }}
                  >
                    <span>Next: Client Details</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ════ STEP 3: CLIENT DETAILS & WAIVER ════ */}
            {step === 3 && (
              <form onSubmit={handleSubmitBooking} className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-body text-white">Review &amp; Contact Details</h2>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-body-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    <ChevronLeft size={14} /> Back to Schedule
                  </button>
                </div>

                {/* Session Summary Card */}
                <div
                  className="rounded-2xl p-4 space-y-2.5"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center justify-between text-body-xs">
                    <span className="text-zinc-400">Scheduled Date &amp; Time:</span>
                    <span className="font-mono font-bold text-violet-300">
                      📅 {date} · 🕒 {format12Hour(time)}
                    </span>
                  </div>
                  {selectedPiercings.length > 0 ? (
                    <div className="space-y-1.5 pt-2 border-t border-zinc-800 text-body-xs">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Selected Piercings ({selectedPiercings.length}):
                      </span>
                      {selectedPiercings.map((p) => (
                        <div key={p.id} className="flex items-center justify-between text-zinc-200">
                          <span>
                            {p.name} {p.side ? `(${p.side})` : ''} {p.upgradeLabel ? `· ${p.upgradeLabel}` : ''}
                          </span>
                          <span className="font-mono text-zinc-400">₱{p.basePrice + (p.upgradePrice ?? 0)}</span>
                        </div>
                      ))}
                      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between font-bold text-white">
                        <span>Est. Total Session Cost:</span>
                        <span className="font-mono text-emerald-400 text-base">₱{totalEstimate}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-body-xs text-zinc-400 pt-2 border-t border-zinc-800">
                      No specific piercings pre-selected. You can discuss options during your consultation.
                    </p>
                  )}
                </div>

                {/* Input Fields */}
                <div className="space-y-3">
                  <label className="block space-y-1">
                    <span className="text-body-xs font-semibold text-zinc-300">Your Full Name *</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Maya Santos"
                      maxLength={60}
                      className="w-full p-3.5 rounded-xl text-body-sm text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-body-xs font-semibold text-zinc-300">
                      Contact Number or Instagram Handle *
                    </span>
                    <input
                      type="text"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      required
                      placeholder="e.g. 09171234567 or @mayasantos"
                      maxLength={80}
                      className="w-full p-3.5 rounded-xl text-body-sm text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-body-xs font-semibold text-zinc-300">
                      Special Requests / Notes (optional)
                    </span>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any anatomy questions, specific jewelry styling, etc."
                      maxLength={150}
                      className="w-full p-3.5 rounded-xl text-body-sm text-white"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)' }}
                    />
                  </label>
                </div>

                {/* Waiver Agreement Checkbox */}
                <div
                  className="p-3.5 rounded-2xl flex items-start gap-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}
                >
                  <input
                    type="checkbox"
                    id="waiver-agree"
                    checked={waiverAgreed}
                    onChange={(e) => setWaiverAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="waiver-agree" className="text-body-xs text-zinc-300 cursor-pointer">
                    I confirm that I am at least 18 years old (or accompanied by a legal guardian), not pregnant or nursing, and agree to the studio's{' '}
                    <button
                      type="button"
                      onClick={() => setShowWaiverModal(true)}
                      className="font-bold underline text-violet-400"
                    >
                      Health &amp; Safety Waiver
                    </button>
                    .
                  </label>
                </div>

                {error && (
                  <p className="text-body-xs font-semibold text-red-400">
                    {error}
                  </p>
                )}

                {/* Final Submit Button */}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-ui text-white transition-transform active:scale-95 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-brand), var(--color-brand-light))',
                    boxShadow: 'var(--shadow-brand)',
                    border: 'none',
                  }}
                >
                  <Send size={16} />
                  <span>{busy ? 'Submitting request…' : 'Submit Appointment Request'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Active Spot Modal ── */}
        {activeModalSpot && (
          <PiercingSpotModal
            spot={activeModalSpot.spot}
            initialSide={activeModalSpot.side}
            existingSelection={selectedPiercings.find(
              (p) => p.name === activeModalSpot.spot.name && (!activeModalSpot.side || p.side === activeModalSpot.side)
            )}
            onAdd={handleAddPiercing}
            onRemove={handleRemovePiercing}
            onClose={() => setActiveModalSpot(null)}
          />
        )}

        {/* ── Floating Cart FAB — always visible when piercings are selected ── */}
        <BookingCartBar
          items={selectedPiercings}
          onRemoveItem={handleRemovePiercing}
          onProceed={() => setStep(2)}
        />

        {/* ── Waiver Modal ── */}
        {showWaiverModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowWaiverModal(false)}
          >
            <div
              className="relative w-full max-w-lg rounded-3xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={22} className="text-violet-400" />
                  <h3 className="font-bold text-body text-white">Before We Pierce — Studio Waiver</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWaiverModal(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-body-xs text-zinc-300 leading-relaxed">
                <p>
                  <strong>Health Check:</strong> We use single-use sterile medical needles for every piercing. Clients must not be under the influence of drugs or alcohol, pregnant or nursing, or dealing with skin infections at the site.
                </p>
                <p>
                  <strong>Age Verification:</strong> You must present a valid government-issued ID. Minors require an in-person parent or legal guardian with IDs.
                </p>
                <p>
                  <strong>50/50 Healing Rule:</strong> We ensure 100% sterile procedure and correct anatomy placement. Proper aftercare (saline spray 2× every other day and LITHA) is your responsibility.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setWaiverAgreed(true);
                  setShowWaiverModal(false);
                }}
                className="w-full py-3 rounded-xl font-bold text-body-sm text-white"
                style={{ background: 'var(--color-brand)' }}
              >
                I Understand &amp; Agree
              </button>
            </div>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
