import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signMail, sendGmail, mailerConfigured } from '../backend/gmail.mjs';
import { gmailScript } from './helpers/gmail-script.mjs';
const secret='test-gmail-secret-12345678901234567890';
const message={id:'booking:confirmed:customer',to:'customer@example.com',subject:'Punkture Studios: Booking confirmed',text:'PHP 100.00 — receipt for José'};
test('actual Apps Script validates Worker signature, deduplicates retries and detects changed payload',async()=>{
  const h=gmailScript();const envelope=await signMail(message,secret);
  assert.equal(h.handle(envelope).status,'sent');assert.equal(h.state.sent.length,1);
  assert.equal(h.handle(await signMail(message,secret)).status,'sent');assert.equal(h.state.sent.length,1);
  assert.equal(h.handle(await signMail({...message,to:'other@example.com'},secret)).status,'needs_review');assert.equal(h.state.sent.length,1);
});
test('unauthorized, modified and stale script requests cannot send email',async()=>{
  const h=gmailScript();
  for(const envelope of [await signMail(message,'wrong'),await signMail(message,secret,Date.now()-600000),{...await signMail(message,secret),payload:'{}'}]) assert.equal(h.handle(envelope).error,'unauthorized');
  assert.equal(h.state.sent.length,0);
});
test('quota and lock contention retry safely without a send intent',async()=>{
  const h=gmailScript();h.state.quota=0;
  assert.equal(h.handle(await signMail(message,secret)).error,'quota_exhausted');assert.equal(h.rows.length,1);
  h.state.quota=100;h.state.busy=true;assert.equal(h.handle(await signMail(message,secret)).error,'busy');
  h.state.busy=false;assert.equal(h.handle(await signMail(message,secret)).status,'sent');
});
test('an interrupted script send leaves durable intent requiring review',async()=>{
  const h=gmailScript();h.state.failSend=true;
  assert.equal(h.handle(await signMail(message,secret)).status,'needs_review');h.state.failSend=false;
  assert.equal(h.handle(await signMail(message,secret)).status,'needs_review');assert.equal(h.state.sent.length,1);
});
test('lost HTTP response after delivery retries through the ledger without another email',async()=>{
  const h=gmailScript();const original=globalThis.fetch;let first=true;
  const env={GMAIL_SCRIPT_SECRET:secret,GMAIL_SCRIPT_URL:'https://script.google.com/macros/s/test/exec',ADMIN_EMAIL:'admin@example.com'};
  globalThis.fetch=async(_url,options)=>{const result=h.handle(JSON.parse(options.body));if(first){first=false;throw new Error('network timeout');}return Response.json(result);};
  try {await assert.rejects(()=>sendGmail(env,message));assert.equal(await sendGmail(env,message),message.id);assert.equal(h.state.sent.length,1);}finally{globalThis.fetch=original;}
});
test('script rejects recipient/header injection and configuration rejects non-Google URLs',async()=>{
  const h=gmailScript();assert.equal(h.handle(await signMail({...message,to:'a@example.com,b@example.com'},secret)).error,'invalid_request');
  assert.equal(h.handle(await signMail({...message,subject:'Punkture Studios:\r\nBcc: x@example.com'},secret)).error,'invalid_request');
  assert.equal(mailerConfigured({GMAIL_SCRIPT_URL:'https://attacker.example/exec',GMAIL_SCRIPT_SECRET:secret,ADMIN_EMAIL:'admin@example.com'}),false);
});
