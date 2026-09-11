import { mailerConfigured, sendGmail } from './gmail.mjs';
export const POLICY = 'PHP 100.00 reservation deposit secures one appointment after verified payment. This advance payment is deducted from your final total at the studio; you pay only the remaining balance. It is not an additional charge. Contact the studio for cancellation or refund requests. Payments received after expiry require review and do not secure a slot.';
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const sql = (env, query, ...args) => env.DB.prepare(query).bind(...args);
const sha = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
const log = (action, id, code) => console.log(JSON.stringify({ action, booking_id: id, code }));
async function remote(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
}
async function paymongo(env, path, body) {
  const r = await remote(`https://api.paymongo.com/v1${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Basic ${btoa(env.PAYMONGO_SECRET_KEY + ':')}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) fail(502, `Payment provider unavailable (${r.status}).`);
  return (await r.json()).data;
}
function decode(field) {
  if ('mapValue' in field) return Object.fromEntries(Object.entries(field.mapValue.fields || {}).map(([k,v]) => [k,decode(v)]));
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(decode);
  if ('integerValue' in field) return Number(field.integerValue);
  return field.booleanValue ?? field.stringValue ?? null;
}
async function settings(env) {
  const r = await remote(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/public/public`);
  if (!r.ok) fail(503, 'Schedule is unavailable. Please try again later.');
  return Object.fromEntries(Object.entries((await r.json()).fields || {}).map(([k, v]) => [k, decode(v)]));
}
export function popupBlocks(s, date) {
  const events = s.events ?? (s.eventDate ? [s] : []);
  return events.some(e => e && e.eventActive === true && e.eventDate <= date && (e.eventEndDate || e.eventDate) >= date);
}
export function validateSchedule(s, date, time, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, 'Invalid schedule.');
  const instant = Date.parse(`${date}T${time}:00+08:00`);
  const today = new Date(now + 28800000).toISOString().slice(0, 10);
  const daysAhead = (Date.parse(date) - Date.parse(today)) / 86400000;
  const days = s.bookingDays?.length ? s.bookingDays : [0,1,2,3,4,5,6];
  const slots = s.bookingSlots?.length ? s.bookingSlots : ['13:00','14:30','16:00','17:30','19:00'];
  if (!Number.isFinite(instant) || new Date(instant + 28800000).toISOString().slice(0,10) !== date || s.bookingEnabled === false || instant <= now || daysAhead < (s.bookingNoticeDays ?? 1) || daysAhead > 21 || !days.includes(new Date(`${date}T12:00:00+08:00`).getUTCDay()) || !slots.includes(time) || s.blockedDates?.includes(date) || popupBlocks(s,date)) fail(409, 'This schedule is no longer available. Choose another slot.');
  return instant;
}
export async function verifySignature(raw, header, secret, live, now = Date.now()) {
  const parts = Object.fromEntries((header || '').split(',').map(x => x.trim().split('=')));
  const signature = parts[live ? 'li' : 'te'];
  if (!/^\d+$/.test(parts.t || '') || Math.abs(now / 1000 - Number(parts.t)) > 300 || !/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, Uint8Array.from(signature.match(/../g), x => parseInt(x,16)), new TextEncoder().encode(`${parts.t}.${raw}`));
}
async function expire(env) {
  await sql(env, "UPDATE bookings SET status='expired' WHERE status IN ('creating','pending') AND expiresAt<=?", Date.now()).run();
}
export function paidPayment(session, booking, live) {
  const a = session.attributes;
  if (session.id !== booking.session_id || a.reference_number !== booking.id || a.livemode !== live) fail(422, 'Payment session mismatch.');
  const p = a.payments?.find(p => p.attributes.status === 'paid');
  if (!p) return null;
  if (p.attributes.amount !== 10000 || p.attributes.currency !== 'PHP' || p.attributes.livemode !== live) fail(422, 'Payment amount or mode mismatch.');
  return p;
}
async function reconcile(env, booking, eventId) {
  const session = await paymongo(env, `/checkout_sessions/${encodeURIComponent(booking.session_id)}`);
  const p = paidPayment(session, booking, env.PAYMONGO_LIVE === 'true');
  if (!p) {
    if (session.attributes.payment_intent?.attributes?.last_payment_error) await sql(env,"UPDATE bookings SET last_error='payment_failed' WHERE id=? AND status='pending'",booking.id).run();
    return;
  }
  if (booking.payment_id === p.id) {
    if (eventId) await sql(env,'INSERT OR IGNORE INTO webhook_events VALUES(?,?,?)',eventId,booking.id,Date.now()).run();
    return;
  }
  const now = Date.now();
  // Slot ownership and payment recording change together; SQL trigger queues both emails in the same transaction.
  const statements = [sql(env, `UPDATE bookings SET status=CASE WHEN status IN ('pending','creating') AND expiresAt>? THEN 'confirmed' ELSE 'payment_review' END, payment_id=?,paidAt=?,last_error=NULL WHERE id=? AND payment_id IS NULL`, now, p.id, (p.attributes.paid_at || p.attributes.created_at) * 1000, booking.id)];
  if (eventId) statements.push(sql(env, 'INSERT OR IGNORE INTO webhook_events VALUES(?,?,?)', eventId, booking.id, now));
  statements.push(sql(env, 'INSERT INTO audit(booking_id,action,createdAt) VALUES(?,?,?)', booking.id, 'payment_verified', now));
  await env.DB.batch(statements);
  log('payment_verified', booking.id);
}
async function staff(request, env) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) fail(401, 'Staff sign-in required.');
  const r = await remote(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
  if (!r.ok) fail(401, 'Staff session expired.');
  const uid = (await r.json()).users?.[0]?.localId;
  if (!uid) fail(403, 'Staff access required.');
  const registry = await remote(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/staff/${encodeURIComponent(uid)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!registry.ok || (await registry.json()).fields?.enabled?.booleanValue !== true) fail(403, 'Staff access required.');
}
async function ready(env) {
  if (!await sql(env,"SELECT id FROM deployment_checks WHERE id='legacy_import'").first()) fail(503, 'Online bookings are awaiting the studio schedule migration.');
  if (!['true','false'].includes(env.PAYMONGO_LIVE) || !env.PAYMONGO_SECRET_KEY?.startsWith(env.PAYMONGO_LIVE === 'true' ? 'sk_live_' : 'sk_test_')) fail(503,'Payment environment is not configured correctly.');
  if (env.BOOKING_LAUNCH_READY !== 'true' || !env.PAYMONGO_SECRET_KEY || !env.PAYMONGO_WEBHOOK_SECRET || !mailerConfigured(env)) fail(503, 'Online payments are not yet available. Please contact the studio.');
}
async function create(request, env) {
  await ready(env);
  let b;
  try { b = await request.json(); } catch { fail(400,'Invalid JSON.'); }
  if (!b || typeof b !== 'object') fail(400,'Invalid booking.');
  for (const [key, max] of [['name',60],['email',254],['contact',80],['notes',300]]) {
    if (typeof b[key] !== 'string' || b[key].length > max || (key !== 'notes' && !b[key].trim())) fail(400, 'Please complete your name, email and contact details.');
    b[key] = b[key].trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) || b.policy !== POLICY || b.consent !== true || !/^[a-f0-9-]{36}$/.test(b.id || '') || !/^[a-f0-9-]{36}$/.test(b.token || '')) fail(400, 'Invalid booking details or consent.');
  const hash = await sha(b.token);
  const requestHash = await sha(JSON.stringify([b.name,b.email,b.contact,b.notes,b.date,b.time,b.policy]));
  const existing = await sql(env,'SELECT * FROM bookings WHERE id=?',b.id).first();
  if (existing) {
    if (existing.token_hash !== hash || existing.request_hash !== requestHash) fail(409,'Booking details changed. Reload before trying again.');
    return json(publicBooking(existing));
  }
  const now = Date.now();
  const rateId = await sha(`${request.headers.get('CF-Connecting-IP') || 'local'}:${Math.floor(now/3600000)}`);
  const rate = await sql(env,'INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count',rateId,now+3600000).first();
  if (rate.count > 10) fail(429,'Too many attempts. Please try again in an hour.');
  const requestedFor = validateSchedule(await settings(env), b.date, b.time, now);
  await expire(env);
  try {
    await sql(env, `INSERT INTO bookings(id,token_hash,request_hash,name,email,contact,notes,date,time,requestedFor,status,createdAt,expiresAt,policy) VALUES(?,?,?,?,?,?,?,?,?,?,'creating',?,?,?)`, b.id,hash,requestHash,b.name,b.email,b.contact,b.notes,b.date,b.time,requestedFor,now,now+900000,POLICY).run();
  } catch (e) {
    if (String(e).includes('UNIQUE')) fail(409,'This slot was just taken. Choose another slot.');
    throw e;
  }
  const returnUrl = `${env.PUBLIC_ORIGIN}/appointment.html#booking=${b.id}&token=${b.token}`;
  try {
    const session = await paymongo(env, '/checkout_sessions', { data: { attributes: {
      billing: { name:b.name,email:b.email }, reference_number:b.id, metadata: { booking_id:b.id },
      description: POLICY, line_items: [{ name:'Appointment reservation deposit',description:POLICY,amount:10000,currency:'PHP',quantity:1 }],
      payment_method_types: env.PAYMENT_METHODS.split(','), send_email_receipt:true, show_description:true, show_line_items:true,
      success_url:returnUrl, cancel_url:returnUrl + '&cancelled=1',
    } } });
    if (!session.id || !session.attributes?.checkout_url?.startsWith('https://checkout.paymongo.com/')) throw new Error('Invalid checkout response');
    await sql(env, "UPDATE bookings SET session_id=?,checkout_url=?,status=CASE WHEN status='creating' THEN 'pending' ELSE status END WHERE id=?", session.id,session.attributes.checkout_url,b.id).run();
  } catch {
    // Never blindly recreate an ambiguous POST: the provider may have accepted it.
    await sql(env,"UPDATE bookings SET last_error='checkout_creation_uncertain' WHERE id=?",b.id).run();
    log('checkout_creation_uncertain',b.id);
  }
  return json(publicBooking(await sql(env,'SELECT * FROM bookings WHERE id=?',b.id).first()));
}
function publicBooking(b) {
  return { id:b.id,status:b.status,date:b.date,time:b.time,expiresAt:b.expiresAt,checkout_url:b.status==='pending'?b.checkout_url:null,amount:b.amount,currency:b.currency,payment_id:b.payment_id,paidAt:b.paidAt,policy:b.policy,last_error:b.last_error };
}
export function emailMessage(b, job) {
  const state = job.kind === 'confirmed' ? 'Booking confirmed' : job.kind === 'cancelled' ? 'Booking cancelled — contact studio about refund' : 'Payment received — slot NOT confirmed; contact studio for refund or rescheduling';
  const receipt = b.payment_id ? `Payment acknowledgement receipt\nReceipt: ${b.id}\nPayMongo payment: ${b.payment_id}\nPaid: PHP 100.00\nPaid at: ${new Date(b.paidAt).toISOString()}\nThis acknowledges the reservation payment; ask the studio for its tax invoice.` : '';
  return { subject:`Punkture Studios: ${state}`, text:`${state}\n\n${b.name}\nAppointment: ${b.date} ${b.time} (Asia/Manila)\nBooking: ${b.id}\n\n${receipt}\n\n${b.policy}\n\n${job.audience==='admin'?`Customer: ${b.email}\nContact: ${b.contact}\nNotes: ${b.notes}`:'Keep this receipt. Contact @punkture_studios for assistance.'}` };
}
export async function deliver(env) {
  const now = Date.now();
  const jobs = (await sql(env,"SELECT * FROM outbox WHERE status='pending' AND nextAt<=? AND leaseUntil<? ORDER BY createdAt LIMIT 5",now,now).all()).results;
  for (const job of jobs) {
    const claim = await sql(env,"UPDATE outbox SET leaseUntil=?,attempts=attempts+1 WHERE id=? AND status='pending' AND leaseUntil<? RETURNING id",now+60000,job.id,now).first();
    if (!claim) continue;
    try {
      const b = await sql(env,'SELECT * FROM bookings WHERE id=?',job.booking_id).first();
      const id = await sendGmail(env, { id: job.id, to: job.audience === 'admin' ? env.ADMIN_EMAIL : b.email, ...emailMessage(b,job) });
      await sql(env,"UPDATE outbox SET status='sent',provider_id=?,leaseUntil=0,last_error=NULL WHERE id=?",id,job.id).run();
    } catch (e) {
      const code = e instanceof Error && /^email_[a-z0-9_]+$/.test(e.message) ? e.message : 'email_delivery_uncertain';
      if (e.review) {
        await sql(env,"UPDATE outbox SET status='needs_review',leaseUntil=0,last_error=? WHERE id=?",code,job.id).run();
      } else {
        const delay = code === 'email_quota_exhausted' ? 6*3600000 : Math.min(3600000,60000*2**Math.min(job.attempts,6));
        await sql(env,'UPDATE outbox SET nextAt=?,leaseUntil=0,last_error=? WHERE id=?',now+delay,code,job.id).run();
      }
      log('email_retry',job.booking_id);
    }
  }
}
async function route(request, env) {
  const url = new URL(request.url);
  if (request.method==='POST' && url.pathname==='/webhooks/paymongo') {
    const raw = await request.text();
    if (!env.PAYMONGO_WEBHOOK_SECRET || !await verifySignature(raw,request.headers.get('Paymongo-Signature'),env.PAYMONGO_WEBHOOK_SECRET,env.PAYMONGO_LIVE==='true')) fail(401,'Invalid signature.');
    let event;
    try { event = JSON.parse(raw).data; } catch { fail(400,'Invalid webhook JSON.'); }
    if (event?.attributes?.type !== 'checkout_session.payment.paid') return json({ignored:true});
    if (!event.id) fail(400,'Missing event ID.');
    if (await sql(env,'SELECT id FROM webhook_events WHERE id=?',event.id).first()) return json({received:true});
    const session = event.attributes.data;
    const b = await sql(env,'SELECT * FROM bookings WHERE id=?',session?.attributes?.reference_number || '').first();
    if (!b) fail(422,'Unknown booking.');
    if (!b.session_id) {
      // Recover a checkout created before a timeout. Verify through the secret-key API first.
      const verified = await paymongo(env,`/checkout_sessions/${encodeURIComponent(session.id)}`);
      if (verified.attributes.reference_number!==b.id) fail(422,'Session mismatch.');
      await sql(env,'UPDATE bookings SET session_id=? WHERE id=? AND session_id IS NULL',session.id,b.id).run();
      b.session_id=session.id;
    }
    await reconcile(env,b,event.id);
    return json({received:true});
  }
  if (request.method==='GET' && url.pathname==='/availability') {
    await ready(env);
    const date = url.searchParams.get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) fail(400,'Invalid date.');
    const schedule = await settings(env);
    if (popupBlocks(schedule,date)) return json({unavailable:schedule.bookingSlots?.length ? schedule.bookingSlots : ['13:00','14:30','16:00','17:30','19:00'], blocked:true});
    const occupied = (await sql(env,"SELECT time FROM bookings WHERE date=? AND (status='confirmed' OR (status IN ('creating','pending') AND expiresAt>?)) UNION SELECT time FROM legacy_holds WHERE date=?",date,Date.now(),date).all()).results;
    return json({unavailable:occupied.map(x=>x.time)});
  }
  if (request.method==='POST' && url.pathname==='/bookings') return create(request,env);
  if (request.method==='GET' && url.pathname.startsWith('/bookings/')) {
    await expire(env);
    const b=await sql(env,'SELECT * FROM bookings WHERE id=?',url.pathname.split('/')[2]).first();
    const token=request.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
    if (!b || b.token_hash!==await sha(token)) fail(404,'Booking not found.');
    const emails=(await sql(env,"SELECT kind,status FROM outbox WHERE booking_id=? AND audience='customer'",b.id).all()).results;
    return json({...publicBooking(b),emails});
  }
  if (url.pathname.startsWith('/admin/')) {
    await staff(request,env);
    if (request.method==='POST' && url.pathname==='/admin/import-legacy') {
      const r=await remote(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents:runQuery`, {
        method:'POST',headers:{Authorization:request.headers.get('Authorization'),'Content-Type':'application/json'},
        body:JSON.stringify({structuredQuery:{from:[{collectionId:'appointments'}],limit:1000}}),
      });
      if (!r.ok) fail(502,'Could not read legacy appointments. No holds were changed.');
      const records=(await r.json()).filter(row=>row.document);
      if (records.length>=1000) fail(409,'Legacy collection needs a paginated migration before launch. No holds were changed.');
      const holds=records.map(row=>({id:row.document.name.split('/').at(-1),...Object.fromEntries(Object.entries(row.document.fields || {}).map(([k,v])=>[k,decode(v)]))})).filter(b=>['requested','confirmed'].includes(b.status) && Date.parse(`${b.date}T${b.time}:00+08:00`)>Date.now());
      await expire(env);
      try {
        await env.DB.batch([
          sql(env,'DELETE FROM legacy_holds'),
          sql(env,"INSERT INTO legacy_holds(id,date,time) SELECT json_extract(value,'$.id'),json_extract(value,'$.date'),json_extract(value,'$.time') FROM json_each(?)",JSON.stringify(holds.map(b=>({id:b.id,date:b.date,time:b.time})))),
          sql(env,"INSERT OR REPLACE INTO deployment_checks VALUES('legacy_import',?)",Date.now()),
          sql(env,'INSERT INTO audit(booking_id,action,createdAt) VALUES(NULL,?,?)','legacy_import',Date.now()),
        ]);
      } catch { fail(409,'Legacy import conflicts with an active payment booking. Resolve the conflict before launch. Previous holds were preserved.'); }
      return json({imported:holds.length});
    }
    if (request.method==='GET' && url.pathname==='/admin/bookings') {
      await expire(env);
      const limit=Math.min(500,Math.max(1,Number(url.searchParams.get('limit'))||30));
      const rows=(await sql(env,'SELECT id,name,email,contact,notes,date,time,status,createdAt,expiresAt,paidAt,payment_id,session_id,amount,last_error FROM bookings ORDER BY createdAt DESC LIMIT ?',limit).all()).results;
      const notifications=(await sql(env,"SELECT booking_id,audience,kind,status,attempts,last_error FROM outbox WHERE status!='sent' ORDER BY createdAt DESC LIMIT 100").all()).results;
      const totals=await sql(env,"SELECT COUNT(payment_id) AS payments,COALESCE(SUM(CASE WHEN payment_id IS NOT NULL THEN amount ELSE 0 END),0) AS grossCentavos, SUM(CASE WHEN status='payment_review' THEN 1 ELSE 0 END) AS needsReview FROM bookings").first();
      return json({bookings:rows,notifications,totals});
    }
    if (request.method==='POST' && /^\/admin\/bookings\/[^/]+\/cancel$/.test(url.pathname)) {
      const id=url.pathname.split('/')[3];
      await env.DB.batch([sql(env,"UPDATE bookings SET status='cancelled' WHERE id=? AND status='confirmed'",id),sql(env,'INSERT INTO audit(booking_id,action,createdAt) VALUES(?,?,?)',id,'staff_cancel_refund_manual',Date.now())]);
      return json({ok:true});
    }
  }
  fail(404,'Not found.');
}
export default {
  async fetch(request,env) {
    const origin=request.headers.get('Origin');
    const allowed=(env.ALLOWED_ORIGINS || '').split(',');
    if (origin && !allowed.includes(origin)) return json({error:'Origin not allowed.'},403);
    let response;
    try {
      if (Number(request.headers.get('Content-Length'))>32768) fail(413,'Request too large.');
      if (request.body) {
        const reader=request.body.getReader(); const chunks=[]; let size=0;
        while (true) { const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>32768) { await reader.cancel(); fail(413,'Request too large.'); } chunks.push(value); }
        const body=new Uint8Array(size); let offset=0; for(const chunk of chunks) { body.set(chunk,offset); offset+=chunk.byteLength; }
        request=new Request(request.url,{method:request.method,headers:request.headers,body});
      }
      response=request.method==='OPTIONS'?new Response(null,{status:204}):await route(request,env);
    } catch (e) {
      const status=e.status || 500;
      log('request_error',undefined,status);
      response=json({error:status===500?'Service unavailable. Please try again.':e.message},status);
    }
    if (origin) response.headers.set('Access-Control-Allow-Origin',origin);
    response.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    response.headers.set('Vary','Origin');
    return response;
  },
  async scheduled(_event,env,ctx) {
    ctx.waitUntil((async()=>{
      await expire(env);
      const rows=(await sql(env,"SELECT * FROM bookings WHERE session_id IS NOT NULL AND payment_id IS NULL AND (status='pending' OR (status='expired' AND createdAt>?)) ORDER BY lastCheckAt LIMIT 10",Date.now()-86400000).all()).results;
      for (const b of rows) {
        await sql(env,'UPDATE bookings SET lastCheckAt=? WHERE id=?',Date.now(),b.id).run();
        try {
          await reconcile(env,b);
          if (b.status==='expired') await paymongo(env,`/checkout_sessions/${encodeURIComponent(b.session_id)}/expire`,{data:{}});
        } catch { log('reconciliation_retry',b.id); }
      }
      await deliver(env);
      await sql(env,'DELETE FROM rate_limits WHERE expiresAt<?',Date.now()).run();
    })());
  },
};
