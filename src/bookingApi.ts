import type { PaymentBooking } from './types';
export const RESERVATION_POLICY = 'PHP 100.00 reservation deposit secures one appointment after verified payment. This advance payment is deducted from your final total at the studio; you pay only the remaining balance. It is not an additional charge. Contact the studio for cancellation or refund requests. Payments received after expiry require review and do not secure a slot.';
export async function bookingApi<T = PaymentBooking>(path: string, options: RequestInit = {}): Promise<T> {
  const base = import.meta.env?.VITE_BOOKING_API_URL;
  if (!base) throw new Error('Online payments are not yet available. Please contact the studio.');
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...options, signal: AbortSignal.timeout(20000), headers: { 'Content-Type': 'application/json', ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Could not reach the booking service.');
  return data as T;
}
