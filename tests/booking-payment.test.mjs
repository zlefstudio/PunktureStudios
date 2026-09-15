import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { gmailScript } from './helpers/gmail-script.mjs';
import { RESERVATION_POLICY } from '../src/bookingApi.ts';
import worker, { POLICY, LEGACY_POLICIES, CHECKOUT_DESCRIPTION, verifySignature, validateSchedule, paidPayment, deliver, emailMessage } from '../backend/worker.mjs';
let db, env, originalFetch, sessions, sends, createCalls, providerDown, emailDown, legacyRecords, staffEnabled, mailer;
function adapter(database) {
  const prepare = query => ({ bind: (...args) => ({
    first: async () => database.prepare(query).get(...args) || null,
    all: async () => ({ results: database.prepare(query).all(...args) }),
    run: async () => database.prepare(query).run(...args),
  }) });
  return { prepare, batch: async statements => {
    database.exec('BEGIN');
    try { const out=[]; for(const s of statements) out.push(await s.run()); database.exec('COMMIT'); return out; }
    catch(e) { database.exec('ROLLBACK'); throw e; }
  } };
}
beforeEach(() => {
  db=new DatabaseSync(':memory:'); db.exec(readFileSync('backend/migrations/0001_booking.sql','utf8'));
  db.exec("INSERT INTO deployment_checks VALUES('legacy_import',0)");
  env={ DB:adapter(db), BOOKING_LAUNCH_READY:'true', PUBLIC_ORIGIN:'https://studio.example', ALLOWED_ORIGINS:'https://studio.example', PAYMONGO_SECRET_KEY:'sk_test_fake',PAYMONGO_WEBHOOK_SECRET:'webhook-secret',PAYMONGO_LIVE:'false',PAYMENT_METHODS:'gcash,card',GMAIL_SCRIPT_URL:'https://script.google.com/macros/s/test/exec',GMAIL_SCRIPT_SECRET:'test-gmail-secret-12345678901234567890',ADMIN_EMAIL:'admin@example.com',FIREBASE_PROJECT_ID:'test',FIREBASE_API_KEY:'fake' };
  mailer=gmailScript();
  sessions=new Map(); sends=[]; createCalls=0; providerDown=false; emailDown=false; legacyRecords=[]; staffEnabled=true;
  originalFetch=globalThis.fetch;
  globalThis.fetch=async (url, options={}) => {
    if (String(url).includes('identitytoolkit.googleapis.com')) return Response.json({users:[{localId:'staff'}]});
    if (String(url).includes('/staff/')) return Response.json({fields:{enabled:{booleanValue:staffEnabled}}});
    if (String(url).endsWith('documents:runQuery')) return Response.json(legacyRecords);
    if (String(url).includes('firestore.googleapis.com')) return Response.json({fields:{ bookingEnabled:{booleanValue:true},bookingNoticeDays:{integerValue:'1'} }});
    if (String(url).includes('script.google.com')) {
      const envelope=JSON.parse(options.body); const message=JSON.parse(envelope.payload);
      sends.push({body:{...message,to:[message.to]},key:message.id});
      mailer.state.quota=emailDown?0:100;
      return Response.json(mailer.handle(envelope));
    }
    if (providerDown) throw new Error('network outage');
    if (String(url).endsWith('/checkout_sessions') && options.method==='POST') {
      createCalls++;
      const a=JSON.parse(options.body).data.attributes;
      assert.equal(a.line_items[0].amount,10000); assert.equal(a.line_items[0].quantity,1); assert.equal(a.send_email_receipt,true);
      assert.equal(a.description,CHECKOUT_DESCRIPTION); assert.equal(a.line_items[0].description,CHECKOUT_DESCRIPTION);
      const s={id:`cs_${createCalls}`,attributes:{...a,livemode:env.PAYMONGO_LIVE==='true',checkout_url:`https://checkout.paymongo.com/cs_${createCalls}`,payments:[]}};
      sessions.set(s.id,s); return Response.json({data:s});
    }
    const id=String(url).split('/').at(-1)==='expire'?String(url).split('/').at(-2):String(url).split('/').at(-1);
    if (!sessions.has(id)) throw new Error('unexpected external request '+url);
    return Response.json({data:sessions.get(id)});
  };
});
afterEach(()=>{globalThis.fetch=originalFetch;db.close();});
/** A bookable week slot: weekdays only (Sat is 1–5 PM, Sun is closed). */
function bookableDate(offset = 2) {
  for (let i = offset; i < offset + 7; i++) {
    const date = new Date(Date.now() + i * 86400000 + 28800000);
    const day = date.getUTCDay();
    if (day >= 1 && day <= 5) return date.toISOString().slice(0, 10);
  }
  throw new Error('No bookable weekday found.');
}
function input() { return {id:crypto.randomUUID(),token:crypto.randomUUID(),name:'Customer',email:'customer@example.com',contact:'09171234567',notes:'Lobe',date:bookableDate(),time:'13:45',policy:POLICY,consent:true}; }
const request=(path, body, headers={})=>worker.fetch(new Request(`https://api.example${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),env);
async function book(b=input()) { const r=await request('/bookings',b); assert.equal(r.status,200); return {b,result:await r.json()}; }
function pay(b,amount=10000) { const row=db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id); const s=sessions.get(row.session_id); s.attributes.payments=[{id:`pay_${b.id}`,attributes:{amount,currency:'PHP',status:'paid',livemode:env.PAYMONGO_LIVE==='true',paid_at:Math.floor(Date.now()/1000)}}]; return s; }
async function webhook(session,id=crypto.randomUUID(),secret=env.PAYMONGO_WEBHOOK_SECRET) {
  const raw=JSON.stringify({data:{id,attributes:{type:'checkout_session.payment.paid',data:session}}});
  const t=Math.floor(Date.now()/1000); const signature=createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex');
  // Live events are signed into `li`, test events into `te`; the other slot stays empty.
  const header=env.PAYMONGO_LIVE==='true'?`t=${t},te=,li=${signature}`:`t=${t},te=${signature},li=`;
  return worker.fetch(new Request('https://api.example/webhooks/paymongo',{method:'POST',headers:{'Paymongo-Signature':header},body:raw}),env);
}
test('end-to-end local flow: pending slot, verified webhook, receipt and admin email',async()=>{
  const {b,result}=await book(); assert.equal(result.status,'pending'); assert.equal(result.payment_id,null);
  const available=await (await request(`/availability?date=${b.date}`)).json();
  assert.deepEqual(available.unavailable,['13:45']);
  assert.deepEqual(available.slots.filter(time=>time!=='13:45').includes('09:00'),true,'the accepted slot list is published for the page');
  const before=await request(`/bookings/${b.id}`,null,{Authorization:`Bearer ${b.token}`}); assert.equal((await before.json()).status,'pending');
  assert.equal((await webhook(pay(b))).status,200);
  const status=await (await request(`/bookings/${b.id}`,null,{Authorization:`Bearer ${b.token}`})).json();assert.equal(status.status,'confirmed');assert.equal(status.amount,10000);
  await deliver(env);assert.equal(sends.length,2);
  assert.match(sends[0].body.text,/Payment acknowledgement receipt/);assert.match(sends[0].body.text,/PHP 100.00/);
  assert.deepEqual(new Set(sends.map(x=>x.body.to[0])),new Set(['customer@example.com','admin@example.com']));
  await deliver(env);assert.equal(sends.length,2);
});
test('atomic competing checkouts allow exactly one owner and one provider checkout',async()=>{
  const a=input(), b={...input(),date:a.date,time:a.time};
  const responses=await Promise.all([request('/bookings',a),request('/bookings',b)]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(createCalls,1);
});
test('request retries reuse checkout and reject changed details or access token',async()=>{
  const {b}=await book();assert.equal((await request('/bookings',b)).status,200);assert.equal(createCalls,1);
  assert.equal((await request('/bookings',{...b,email:'other@example.com'})).status,409);
  assert.equal((await request(`/bookings/${b.id}`,null,{Authorization:'Bearer wrong'})).status,404);
});
test('forged and duplicate webhooks never create duplicate payments or notifications',async()=>{
  const {b}=await book();const s=pay(b);const id='evt_duplicate';
  assert.equal((await webhook(s,id,'attacker')).status,401);
  assert.equal(db.prepare('SELECT status FROM bookings').get().status,'pending');
  assert.equal((await webhook(s,id)).status,200);assert.equal((await webhook(s,id)).status,200);assert.equal((await webhook(s,'evt_second')).status,200);
  assert.equal(db.prepare('SELECT count(*) n FROM outbox').get().n,2);
  assert.equal(db.prepare('SELECT count(*) n FROM audit').get().n,1);
});
test('wrong amounts and mode are rejected without confirmation',async()=>{
  const {b}=await book();const s=pay(b,1);assert.equal((await webhook(s)).status,422);
  s.attributes.payments[0].attributes.amount=10000;s.attributes.livemode=true;assert.equal((await webhook(s)).status,422);
  assert.equal(db.prepare('SELECT status FROM bookings').get().status,'pending');assert.equal(db.prepare('SELECT count(*) n FROM outbox').get().n,0);
});
test('expired reservation releases slot and late payment goes to review without stealing it',async()=>{
  const {b}=await book();db.prepare('UPDATE bookings SET expiresAt=? WHERE id=?').run(Date.now()-1,b.id);
  const replacement={...input(),date:b.date,time:b.time};await book(replacement);
  assert.equal((await webhook(pay(b))).status,200);
  assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(b.id).status,'payment_review');
  assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(replacement.id).status,'pending');
  await deliver(env);assert.match(sends[0].body.text,/slot NOT confirmed/);
});
test('checkout timeouts do not blindly create another charge and expire without cron',async()=>{
  providerDown=true;const {b,result}=await book();assert.equal(result.status,'creating');providerDown=false;
  await request('/bookings',b);assert.equal(createCalls,0);
  db.prepare('UPDATE bookings SET expiresAt=?').run(Date.now()-1);
  const status=await (await request(`/bookings/${b.id}`,null,{Authorization:`Bearer ${b.token}`})).json();assert.equal(status.status,'expired');
});
test('email provider failures retry independently and keep stable idempotency keys',async()=>{
  const {b}=await book();await webhook(pay(b));emailDown=true;await deliver(env);
  assert.equal(db.prepare("SELECT count(*) n FROM outbox WHERE status='pending'").get().n,2);
  const keys=sends.map(s=>s.key);emailDown=false;db.exec('UPDATE outbox SET nextAt=0');await deliver(env);
  assert.deepEqual(sends.slice(2).map(s=>s.key),keys);assert.equal(db.prepare("SELECT count(*) n FROM outbox WHERE status='sent'").get().n,2);
});
test('Gmail quota delays longer than a day still deliver safely after reset',async()=>{
  const {b}=await book();await webhook(pay(b));db.prepare('UPDATE outbox SET attempts=1,createdAt=?').run(Date.now()-24*3600000);await deliver(env);
  assert.equal(sends.length,2);assert.equal(db.prepare("SELECT count(*) n FROM outbox WHERE status='sent'").get().n,2);
});
test('backend reconciliation confirms paid checkout even without customer return or webhook',async()=>{
  const {b}=await book();pay(b);let task;await worker.scheduled({},env,{waitUntil:p=>{task=p;}});await task;
  assert.equal(db.prepare('SELECT status FROM bookings').get().status,'confirmed');assert.equal(sends.length,2);
});
test('staff endpoints require authentication and launch configuration fails closed',async()=>{
  assert.equal((await request('/admin/bookings')).status,401);env.BOOKING_LAUNCH_READY='false';assert.equal((await request('/bookings',input())).status,503);
});
test('schedule validates Manila day, notice period, impossible dates, blackout and slots',()=>{
  const now=Date.parse('2026-09-10T17:00:00Z'); // Friday Sep 11 in Manila
  assert.equal(validateSchedule({bookingDays:[6]},'2026-09-12','13:00',now),Date.parse('2026-09-12T13:00:00+08:00'));
  for(const [s,date,time] of [[{},'2026-09-11','13:00'],[{},'2026-09-12','25:00'],[{blockedDates:['2026-09-12']},'2026-09-12','13:00'],[{bookingEnabled:false},'2026-09-12','13:00'],[{},'2026-02-30','13:00']]) assert.throws(()=>validateSchedule(s,date,time,now));
  // Studio grid: Sunday closed, Saturday opens at 1 PM, weekdays run 9 AM – 8 PM
  // in 45-minute steps with a one-hour noon break.
  assert.throws(()=>validateSchedule({},'2026-09-13','13:00',now));
  assert.throws(()=>validateSchedule({},'2026-09-12','09:00',now));
  assert.throws(()=>validateSchedule({},'2026-09-14','12:00',now));
  assert.throws(()=>validateSchedule({},'2026-09-14','14:00',now));
  assert.equal(validateSchedule({},'2026-09-14','14:30',now),Date.parse('2026-09-14T14:30:00+08:00'));
  assert.equal(validateSchedule({bookingDaySlots:{'6':['10:00']}},'2026-09-12','10:00',now),Date.parse('2026-09-12T10:00:00+08:00'));
  assert.throws(()=>validateSchedule({bookingDaySlots:{'6':['10:00']}},'2026-09-14','10:00',now));
});
test('a previously shipped policy wording still checks out, an unknown one is rejected',async()=>{
  // Rolling deploys: the frontend and the Worker can be live minutes apart, so the
  // wording the page last shipped must keep working (this is what broke checkout
  // with "Invalid booking details or consent." before the allowlist).
  const legacy={...input(),policy:LEGACY_POLICIES[0]};
  const {b}=await book(legacy);
  assert.equal(db.prepare('SELECT policy FROM bookings WHERE id=?').get(b.id).policy,LEGACY_POLICIES[0],'the accepted wording is stored');
  assert.equal((await request('/bookings',{...input(),policy:'Anything else entirely.'})).status,400);
  assert.equal((await request('/bookings',{...input(),consent:false})).status,400);
});
test('the hosted checkout description stays short while the full policy is stored',async()=>{
  assert.ok(CHECKOUT_DESCRIPTION.length<=255,`checkout description is ${CHECKOUT_DESCRIPTION.length} chars`);
  const {b}=await book();
  assert.notEqual(CHECKOUT_DESCRIPTION,POLICY,'the provider copy is a summary, not the 625-character policy');
  assert.equal(db.prepare('SELECT policy FROM bookings WHERE id=?').get(b.id).policy,POLICY,'the row keeps the full accepted policy');
});
test('signature binds raw bytes, timestamp and environment',async()=>{
  const raw='{"a":1}', t=Math.floor(Date.now()/1000);const sig=createHmac('sha256','secret').update(`${t}.${raw}`).digest('hex');const h=`t=${t},te=${sig},li=`;
  assert.equal(await verifySignature(raw,h,'secret',false),true);assert.equal(await verifySignature(raw+' ',h,'secret',false),false);assert.equal(await verifySignature(raw,h,'secret',true),false);assert.equal(await verifySignature(raw,h,'secret',false,Date.now()+600000),false);
});
test('receipt copy never labels a review payment as a confirmed booking',()=>{
  assert.equal(RESERVATION_POLICY, POLICY, 'Customer consent must match the server and receipt policy');
  const text=emailMessage({id:'b',name:'<script>',date:'2026-09-12',time:'13:00',payment_id:'pay_1',paidAt:Date.now(),policy:POLICY},{kind:'payment_review',audience:'customer'});
  assert.match(text.subject,/NOT confirmed/);assert.match(text.text,/Paid: PHP 100.00/);assert.equal(text.html,undefined);
  assert.throws(()=>paidPayment({id:'wrong',attributes:{}},{id:'b',session_id:'cs_right'},false));
});

test('legacy appointments block exact slots and missing migration prevents launch',async()=>{
  const b=input();db.prepare('INSERT INTO legacy_holds VALUES(?,?,?)').run('old',b.date,b.time);
  assert.equal((await request('/bookings',b)).status,409);
  assert.deepEqual((await (await request(`/availability?date=${b.date}`)).json()).unavailable,[b.time]);
  db.exec('DELETE FROM deployment_checks');assert.equal((await request('/bookings',input())).status,503);
});
test('invalid JSON and oversized streamed request are rejected',async()=>{
  const bad=new Request('https://api.example/bookings',{method:'POST',body:'{'});
  assert.equal((await worker.fetch(bad,env)).status,400);
  const huge=new Request('https://api.example/bookings',{method:'POST',body:'x'.repeat(32769)});
  assert.equal((await worker.fetch(huge,env)).status,413);
});

test('staff registry authorization and cancellation preserve payment audit and queue notices',async()=>{
  const {b}=await book();await webhook(pay(b));
  const headers={Authorization:'Bearer staff-token'};
  staffEnabled=false;assert.equal((await request('/admin/bookings',null,headers)).status,403);
  staffEnabled=true;assert.equal((await request(`/admin/bookings/${b.id}/cancel`,{},headers)).status,200);
  const report=await (await request('/admin/bookings',null,headers)).json();
  assert.equal(report.bookings[0].status,'cancelled');assert.equal(report.totals.grossCentavos,10000);
  assert.equal(db.prepare('SELECT count(*) n FROM outbox').get().n,4);
  assert.deepEqual((await (await request(`/availability?date=${b.date}`)).json()).unavailable,[]);
});
test('legacy import is authenticated, enables launch and preserves holds on conflicting refresh',async()=>{
  const b=input(); const headers={Authorization:'Bearer staff-token'};
  legacyRecords=[{document:{name:'projects/test/documents/appointments/old',fields:{date:{stringValue:b.date},time:{stringValue:b.time},status:{stringValue:'confirmed'}}}}];
  db.exec('DELETE FROM deployment_checks');
  assert.equal((await request('/admin/import-legacy',{},headers)).status,200);
  assert.equal(db.prepare('SELECT count(*) n FROM legacy_holds').get().n,1);
  const second={...input(),time:'15:15'};await book(second);
  legacyRecords.push({document:{name:'projects/test/documents/appointments/conflict',fields:{date:{stringValue:second.date},time:{stringValue:second.time},status:{stringValue:'requested'}}}});
  assert.equal((await request('/admin/import-legacy',{},headers)).status,409);
  assert.equal(db.prepare('SELECT count(*) n FROM legacy_holds').get().n,1);
});

test('mismatched live/test key configuration blocks checkout before charging',async()=>{
  env.PAYMONGO_LIVE='true';assert.equal((await request('/bookings',input())).status,503);assert.equal(createCalls,0);
});

test('customer release frees an unpaid hold immediately and never frees a paid slot',async()=>{
  const {b}=await book();
  assert.equal((await request(`/bookings/${b.id}/release`,{})).status,404);
  assert.equal((await request(`/bookings/${b.id}/release`,{},{Authorization:'Bearer wrong'})).status,404);
  assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(b.id).status,'pending');
  assert.equal((await request(`/bookings/${b.id}/release`,{},{Authorization:`Bearer ${b.token}`})).status,200);
  assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(b.id).status,'expired');
  assert.deepEqual((await (await request(`/availability?date=${b.date}`)).json()).unavailable,[]);
  const replacement={...input(),date:b.date,time:b.time};await book(replacement);
  assert.equal(db.prepare('SELECT count(*) n FROM outbox').get().n,0);
});

test('release verifies with the provider so a paid-but-unnotified slot stays owned and confirmed',async()=>{
  const {b}=await book();pay(b);
  const r=await request(`/bookings/${b.id}/release`,{},{Authorization:`Bearer ${b.token}`});
  assert.equal(r.status,200);assert.equal((await r.json()).status,'confirmed');
  assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get(b.id).status,'confirmed');
  assert.equal(db.prepare('SELECT count(*) n FROM outbox').get().n,2);
});

test('live mode end-to-end: sk_live_ key, li signature and livemode payment confirm exactly once',async()=>{
  env.PAYMONGO_LIVE='true';env.PAYMONGO_SECRET_KEY='sk_live_fake';
  const {b,result}=await book();assert.equal(result.status,'pending');
  const s=pay(b);assert.equal(s.attributes.livemode,true);
  assert.equal((await webhook(s,'evt_live_attacker','attacker')).status,401);
  assert.equal(db.prepare('SELECT status FROM bookings').get().status,'pending');
  assert.equal((await webhook(s,'evt_live')).status,200);assert.equal((await webhook(s,'evt_live')).status,200);
  assert.equal(db.prepare('SELECT status FROM bookings').get().status,'confirmed');
  await deliver(env);assert.equal(sends.length,2);
});

test('Gmail ambiguous send is visible for manual review and never blindly resent',async()=>{
  const {b}=await book();await webhook(pay(b));mailer.state.failSend=true;
  await deliver(env);assert.equal(db.prepare("SELECT count(*) n FROM outbox WHERE status='needs_review'").get().n,2);
  const attempts=mailer.state.sent.length;await deliver(env);assert.equal(mailer.state.sent.length,attempts);
});

test('full cart snapshot survives checkout, staff retrieval and admin notification',async()=>{
  const {bookingCartNotes}=await import('../src/components/booking/cartSnapshot.ts');
  const items=Array.from({length:12},(_,i)=>({id:String(i),name:`Selected item ${i}`,category:'EAR',basePrice:400,upgradePrice:200,upgradeLabel:'200 Titanium',side:'right'}));
  const notes=bookingCartNotes(items,'Please discuss placement.');
  assert.ok(notes.length>300);
  const {b}=await book({...input(),notes});
  assert.equal(db.prepare('SELECT notes FROM bookings WHERE id=?').get(b.id).notes,notes);
  const report=await (await request('/admin/bookings',null,{Authorization:'Bearer staff-token'})).json();
  assert.equal(report.bookings.find(row=>row.id===b.id).notes,notes);
  await webhook(pay(b));await deliver(env);
  assert.ok(sends.find(message=>message.body.to[0]==='admin@example.com').body.text.includes(notes));
  assert.equal((await request('/bookings',{...input(),notes:'x'.repeat(20001)})).status,400);
});
