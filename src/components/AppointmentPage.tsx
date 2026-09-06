import { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { firestore } from '../firebase';
import { CheckCircle2, ArrowLeft, Send } from 'lucide-react';

/** PUBLIC booking request page — secured by Firestore rules (create only). */
export function AppointmentPage() {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const trimmedNotes = notes.trim();
      await addDoc(collection(firestore, 'appointments'), {
        name: name.trim(),
        contact: contact.trim(),
        date: date.trim(),
        time: time.trim(),
        // Firestore rejects `undefined` — only include notes when provided.
        ...(trimmedNotes ? { notes: trimmedNotes } : {}),
        status: 'requested',
        createdAt: Date.now(),
      });
      setDone(true);
    } catch (err) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code.includes('permission-denied')) {
        setError('The booking form is temporarily closed (rules not published yet).');
      } else if (code.includes('offline') || code.includes('network') || code.includes('unavailable')) {
        setError('No internet — please try again when you have a connection.');
      } else {
        setError('Could not save your request. Please try again.');
      }
    } finally {
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
    <div
      className="min-h-dvh w-full overflow-x-hidden"
      style={{
        background: 'radial-gradient(1000px 500px at 50% -10%, rgba(139,92,246,0.18) 0%, transparent 60%), var(--color-base)',
        color: 'var(--color-text)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div className="mx-auto w-full max-w-md px-5 py-7" style={{ animation: 'pk-fade-in 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <a
          href="/live.html"
          className="inline-flex items-center gap-1 text-body-xs font-semibold mb-5"
          style={{ color: 'var(--color-text-faint)' }}
        >
          <ArrowLeft size={13} /> Back to live queue
        </a>

        <div className="flex items-center gap-2.5 mb-1">
          <img
            src="/logo.png"
            alt="PUNKTURE STUDIOS"
            className="w-9 h-9 object-contain drop-shadow select-none"
          />
          <p className="font-sanguine select-none leading-none" style={{ fontSize: 17, letterSpacing: '0.12em', color: 'var(--color-text)' }}>
            PUNKTURE STUDIOS
          </p>
        </div>
        <p className="text-[10px] uppercase tracking-[0.2em] mb-6" style={{ color: 'var(--color-text-faint)' }}>
          Home studio appointment
        </p>

        {done ? (
          <div
            className="rounded-3xl p-7 text-center space-y-3"
            style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.35)' }}
          >
            <CheckCircle2 size={34} style={{ color: 'var(--color-success-text)', margin: '0 auto' }} />
            <p className="font-black" style={{ fontSize: 19 }}>Request sent! ✨</p>
            <p className="text-body-sm" style={{ color: 'var(--color-text-muted)' }}>
              Thank you, {name.trim().split(' ')[0]}! We'll confirm your appointment through {contact.trim()}. 📅 {date} · {time}
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
            onSubmit={handleSubmit}
            className="rounded-3xl p-5 space-y-3"
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
                <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label className="block">
                <span className="text-body-xs" style={{ color: 'var(--color-text-faint)' }}>Preferred time *</span>
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

            {error && (
              <p className="text-body-xs font-semibold" style={{ color: 'var(--color-error-text)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-ui font-bold"
              style={{
                background: 'var(--color-brand)',
                color: '#fff',
                border: 'none',
                opacity: busy ? 0.6 : 1,
                cursor: 'pointer',
              }}
            >
              <Send size={15} />
              {busy ? 'Sending…' : 'Send appointment request'}
            </button>
            <p className="text-[10px] text-center" style={{ color: 'var(--color-text-faint)' }}>
              PUNKTURE STUDIOS · this is a request only — not confirmed until we contact you.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

