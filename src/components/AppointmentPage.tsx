import { useRef, useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { firestore } from '../firebase';
import { CheckCircle2, Send, X, ShieldCheck } from 'lucide-react';
import { PublicShell } from './PublicShell';
import { manilaDate, validAppointmentDate } from '../validation';

/** PUBLIC booking request page — secured by Firestore rules (create only). */
export function AppointmentPage() {
  const pending = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [waiverAgreed, setWaiverAgreed] = useState(false);

  function handleInitialSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    if (!name.trim() || !contact.trim()) {
      setError('Enter your name and contact details.');
      return;
    }
    if (!validAppointmentDate(date, time)) {
      setError('Choose a future date and time within the next 366 days (Philippine time).');
      return;
    }
    setError(null);
    setShowWaiverModal(true);
  }

  async function handleConfirmSubmit() {
    if (pending.current || !waiverAgreed) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const trimmedNotes = notes.trim();
      await setDoc(doc(firestore, 'appointments', requestId.current), {
        name: name.trim(),
        contact: contact.trim(),
        date: date.trim(),
        time: time.trim(),
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        status: 'requested',
        createdAt: serverTimestamp(),
        requestedFor: Date.parse(`${date}T${time}:00+08:00`),
      });
      setShowWaiverModal(false);
      setDone(true);
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code.includes('permission-denied')) {
        setError('The request could not be accepted. Please contact the studio if you may have already submitted it.');
      } else if (code.includes('offline') || code.includes('network') || code.includes('unavailable')) {
        setError('No internet — please try again when you have a connection.');
      } else {
        setError('Could not save your request. Please try again.');
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--color-border)',
    borderRadius: '12px',
    padding: '11px 13px',
    fontSize: '14px',
    color: 'var(--color-text)',
    outline: 'none',
  };

  return (
    <PublicShell page="appointment">
      <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: 'var(--color-text-faint)' }}>
        Home studio appointment
      </p>
      <h1 className="font-black leading-tight" style={{ fontSize: 24 }}>
        Book an appointment
      </h1>

      {done ? (
        <div
          className="rounded-3xl p-8 text-center space-y-3 mt-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
        >
          <CheckCircle2 size={36} style={{ margin: '0 auto', color: 'var(--color-success-text)' }} />
          <p className="font-black" style={{ fontSize: 18 }}>
            Request sent! 🎉
          </p>
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Thank you, {name.trim().split(' ')[0]}! We'll confirm your appointment through{' '}
            {contact.trim()}. 📅 {date} · {time}
          </p>
          <a
            href="/live.html"
            className="inline-block px-5 py-2.5 rounded-xl text-ui font-bold mt-1"
            style={{ background: 'var(--color-success)', color: '#fff' }}
          >
            Back to live queue
          </a>
        </div>
      ) : (
        <form
          onSubmit={handleInitialSubmit}
          className="rounded-3xl p-5 space-y-3 mt-5"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)' }}
        >
          <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
            Pick your preferred date and time — we'll confirm through your contact.
          </p>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Name *</span>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name" maxLength={60} />
          </label>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Contact (cellphone / email) *</span>
            <input style={inputStyle} value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="0917 123 4567" maxLength={80} />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Preferred date *</span>
              <input type="date" min={manilaDate()} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="block">
              <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Preferred time (Philippines) *</span>
              <input type="time" style={inputStyle} value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>
          </div>

          <label className="block">
            <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Notes (optional)</span>
            <textarea
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Which piercing are you considering? (so we can advise you)"
              maxLength={300}
            />
          </label>

          {error && !showWaiverModal && (
            <p className="text-body-xs font-semibold" style={{ color: 'var(--color-error-text)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-ui font-bold"
            style={{
              background: 'var(--color-brand)',
              color: '#fff',
              border: 'none',
              opacity: busy ? 0.6 : 1,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-brand)',
            }}
          >
            <Send size={15} />
            Send appointment request
          </button>
          <p className="text-[10px] text-center" style={{ color: 'var(--color-text-faint)' }}>
            PUNKTURE STUDIOS · this is a request only — not confirmed until we contact you.
          </p>
        </form>
      )}

      {/* ── Studio Waiver & Agreement Modal ── */}
      {showWaiverModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(6px)',
            animation: 'pk-fade-in 0.2s ease-out both',
          }}
          onClick={() => !busy && setShowWaiverModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl flex flex-col overflow-hidden"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border-strong)',
              maxHeight: '90vh',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--color-brand-bg)', color: 'var(--color-brand-text)' }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h2 className="font-black text-heading-sm leading-snug">Studio Waiver &amp; Policies</h2>
                  <p className="text-body-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Please review safety guidelines before completing your booking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !busy && setShowWaiverModal(false)}
                className="p-1.5 rounded-lg text-body-sm"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--color-text-muted)',
                  border: 'none',
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-3.5 text-body-sm" style={{ color: 'var(--color-text)' }}>
              <div
                className="p-3.5 rounded-2xl space-y-1.5"
                style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.22)' }}
              >
                <p className="text-body-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-error-text)' }}>
                  🚫 Eligibility Criteria
                </p>
                <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  We cannot pierce anyone who is pregnant or breastfeeding, under the influence of alcohol or drugs, a minor without an in-person legal guardian and valid IDs, or experiencing active skin rashes or fever.
                </p>
              </div>

              <div
                className="p-3.5 rounded-2xl space-y-1.5"
                style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.22)' }}
              >
                <p className="text-body-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-warn-text)' }}>
                  ⚠️ Health Conditions &amp; Caffeine (At Your Own Risk)
                </p>
                <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  If you have diabetes, heart conditions, bleeding disorders, keloid history, metal allergies, or had coffee/caffeine today, proceeding is at your own discretion and risk with informed consent.
                </p>
              </div>

              <div
                className="p-3.5 rounded-2xl space-y-1.5"
                style={{ background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.25)' }}
              >
                <p className="text-body-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-brand-text)' }}>
                  🤝 The 50/50 Care Rule &amp; Jewelry
                </p>
                <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  We provide 100% autoclave sterilized tools, single-use needles, and optional implant-grade titanium jewelry. Aftercare is your 50% commitment (clean with sterile saline only; never twist or pick). Choosing standard stainless steel over titanium carries individual sensitivity risks at your own discretion.
                </p>
              </div>

              <div
                className="p-3.5 rounded-2xl space-y-1"
                style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--color-border)' }}
              >
                <p className="text-body-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-faint)' }}>
                  📅 Booking Request Notice
                </p>
                <p className="text-body-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  Submitting this form submits an appointment request for <b>{date} at {time}</b>. Our team will contact you at <b>{contact}</b> to confirm availability.
                </p>
              </div>

              {error && (
                <p className="text-body-xs font-semibold p-2.5 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--color-error-text)' }}>
                  {error}
                </p>
              )}

              {/* Agreement checkbox */}
              <label
                className="flex items-start gap-3 p-3.5 rounded-2xl cursor-pointer transition-colors"
                style={{
                  background: waiverAgreed ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${waiverAgreed ? 'rgba(16,185,129,0.40)' : 'var(--color-border-strong)'}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={waiverAgreed}
                  onChange={(e) => setWaiverAgreed(e.target.checked)}
                  className="mt-0.5"
                  style={{ accentColor: 'var(--color-brand)', width: 17, height: 17, flexShrink: 0 }}
                />
                <span className="text-body-xs font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
                  I confirm that I have read, understood, and agree to the studio waiver, health guidelines, and appointment terms.
                </span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t flex items-center justify-end gap-2.5" style={{ borderColor: 'var(--color-border)' }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowWaiverModal(false)}
                className="px-4 py-2.5 rounded-xl text-ui-sm font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Back to edit
              </button>
              <button
                type="button"
                disabled={!waiverAgreed || busy}
                onClick={handleConfirmSubmit}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-ui-sm font-bold transition-all"
                style={{
                  background: waiverAgreed && !busy ? 'var(--color-brand)' : 'rgba(255,255,255,0.08)',
                  color: waiverAgreed && !busy ? '#fff' : 'var(--color-text-faint)',
                  border: 'none',
                  cursor: waiverAgreed && !busy ? 'pointer' : 'not-allowed',
                  boxShadow: waiverAgreed && !busy ? 'var(--shadow-brand)' : 'none',
                }}
              >
                {busy ? (
                  <>Sending request…</>
                ) : (
                  <>
                    <Send size={14} />
                    Confirm &amp; Send Request
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </PublicShell>
  );
}
