import type { PaymentBooking } from './types';
export const RESERVATION_POLICY = 'PHP 100.00 reservation deposit secures one appointment once payment is verified. It is an advance toward your final total at the studio and never an extra charge — you pay only the remaining balance. Plans change, and that is okay: cancel or reschedule at least 24 hours before your appointment and we will refund the PHP 100.00 in full on request. With less than 24 hours notice, or if you arrive 15 minutes or more after your appointment time, the PHP 100.00 deposit serves as the cancellation or late fee for the studio time we kept reserved for you. Payments received after expiry require review and do not secure a slot.';
export async function bookingApi<T = PaymentBooking>(path: string, options: RequestInit = {}): Promise<T> {
  const base = import.meta.env?.VITE_BOOKING_API_URL;
  if (!base) throw new Error('Online payments are not yet available. Please contact the studio.');
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...options, signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not reach the booking service.');
  return data as T;
}
