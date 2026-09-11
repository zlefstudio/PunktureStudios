// Only the server possesses this shared secret. Never call the mailer from a browser.
export function mailerConfigured(env) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(env.GMAIL_SCRIPT_URL || '')
    && typeof env.GMAIL_SCRIPT_SECRET === 'string' && env.GMAIL_SCRIPT_SECRET.length >= 32
    && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(env.ADMIN_EMAIL || '');
}
export async function signMail(payload, secret, now = Date.now()) {
  const timestamp = Math.floor(now / 1000);
  const text = JSON.stringify(payload);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${text}`)))].map(n => n.toString(16).padStart(2,'0')).join('');
  return { timestamp, payload: text, signature };
}
export async function sendGmail(env, message) {
  if (!mailerConfigured(env)) throw new Error('email_configuration_missing');
  const response = await fetch(env.GMAIL_SCRIPT_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(await signMail(message, env.GMAIL_SCRIPT_SECRET)),
    // Apps Script ContentService redirects the response to script.googleusercontent.com.
    redirect: 'follow', signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`email_http_${response.status}`);
  const result = await response.json();
  if (result.status === 'sent' && result.id === message.id) return result.id;
  if (result.status === 'needs_review') throw Object.assign(new Error('email_delivery_needs_review'), { review: true });
  const reasons = new Set(['quota_exhausted','busy','not_configured','unauthorized','invalid_request']);
  throw new Error(reasons.has(result.error) ? `email_${result.error}` : 'email_delivery_uncertain');
}
