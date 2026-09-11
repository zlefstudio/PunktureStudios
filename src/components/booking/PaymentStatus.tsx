import { useEffect, useState } from 'react';
import { bookingApi } from '../../bookingApi';
import type { PaymentBooking } from '../../types';

export function PaymentStatus({ id, token, cancelled = false }: { id: string; token: string; cancelled?: boolean }) {
  const [booking, setBooking] = useState<PaymentBooking | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (active) setNow(Date.now());
      try {
        const b = await bookingApi(`/bookings/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (active) { setBooking(b); setError(''); setNow(Date.now()); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Status unavailable.'); }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [id, token]);
  const titles = { creating: 'Preparing payment', pending: cancelled || booking?.last_error === 'payment_failed' ? 'Payment not completed' : 'Waiting for verified payment', confirmed: 'Booking confirmed', expired: 'Reservation expired', payment_review: 'Payment received — admin review required', cancelled: 'Booking cancelled' };
  return <section className="rounded-3xl p-6 space-y-4 bg-zinc-900 border border-zinc-700" aria-live="polite">
    <h2 className="text-2xl font-bold">{booking ? titles[booking.status] : 'Checking booking status…'}</h2>
    {error && <p role="alert" className="text-red-300">{error} Do not pay again while your status is uncertain. Keep your booking reference.</p>}
    <p className="break-all">Booking reference: {id}</p>
    {booking && <>
      <p>{booking.date} · {booking.time} (Asia/Manila)</p>
      <p>{booking.policy}</p>
      {booking.status === 'pending' && <>
        <p>Temporary hold expires at {new Date(booking.expiresAt).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })} Manila time. A redirect or payment screenshot does not confirm your booking.</p>
        {booking.checkout_url && booking.expiresAt > now && <a href={booking.checkout_url} rel="noreferrer" className="inline-block rounded-xl bg-violet-600 px-5 py-3 font-bold">Pay PHP 100.00 with PayMongo</a>}
        <p>Failed attempt? You may retry in the same PayMongo checkout before expiry.</p>
      </>}
      {booking.status === 'creating' && <p>Checkout is being prepared or its response is delayed. Do not submit another payment. This temporary hold expires after 15 minutes.</p>}
      {booking.status === 'expired' && <p>This slot is no longer held. If you were charged, contact the studio with this reference; a late payment requires review.</p>}
      {booking.status === 'payment_review' && <p>Your payment did not secure a slot. The studio has been queued for notification to arrange a refund or rescheduling.</p>}
      {booking.status === 'cancelled' && <p>Contact the studio about your reservation payment. Cancellation does not automatically issue a refund.</p>}
      {booking.payment_id && <div className="rounded-xl border border-zinc-600 p-4 space-y-2">
        <h3 className="font-bold">Payment acknowledgement receipt</h3>
        <p>Paid: PHP 100.00 · PayMongo reference: {booking.payment_id}</p>
        <p>Paid at: {booking.paidAt ? new Date(booking.paidAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : '—'} (Asia/Manila)</p>
        <p>This acknowledges the reservation payment. Ask the studio for its tax invoice.</p>
        <button type="button" onClick={() => window.print()} className="underline">Print / save receipt</button>
      </div>}
      {booking.payment_id && <p>Email confirmation and receipt: {booking.emails?.find(e => e.kind === booking.status)?.status === 'sent' ? 'Accepted by email provider. Check your inbox and spam folder.' : 'Queued or awaiting delivery review. Contact the studio if it does not arrive.'}</p>}
    </>}
    <p><a className="underline" href="https://www.instagram.com/punkture_studios/" rel="noreferrer">Contact @punkture_studios</a></p>
    {booking && ['expired','cancelled','payment_review'].includes(booking.status) && <a className="underline" href="/appointment.html">Choose another schedule</a>}
  </section>;
}
