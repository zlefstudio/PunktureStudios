import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
/** A 4-column Google Sheet backed by an array of rows. */
function mockSheet(rows) {
  return {
    getLastRow:()=>rows.length,
    appendRow:values=>{ rows.push([...values]); },
    getRange:(row,col,count=1)=>({
      setValues:values=>values.forEach((v,i)=> { rows[row-1+i] ??= []; v.forEach((x,j)=>{rows[row-1+i][col-1+j]=x;}); }),
      getValues:()=>rows.slice(row-1,row-1+count).map(r=>r.slice(col-1,col+3)),
      createTextFinder:id=>({ matchEntireCell:()=>({ findNext:()=> { const index=rows.findIndex((r,i)=>i>=row-1&&r[col-1]===id);return index<0?null:{getRow:()=>index+1}; } }) }),
    }),
  };
}
/** Minimal CalendarApp calendar: events keyed by id, tags, reminders and deletion. */
function mockCalendar(state) {
  let next = 0;
  const events = state.events;
  return {
    getId:()=>'punkture-bookings@group.calendar.google.com',
    getName:()=>'Punkture Bookings',
    createEvent:(title,start,end,options={})=>{
      const id=`event-${++next}@google.com`;
      const event={ id, title, start, end, description:options.description, tags:{}, reminders:[],
        getId:()=>id, setTag:(k,v)=>{event.tags[k]=v;}, getTag:k=>event.tags[k] ?? null,
        deleteEvent:()=>{ events.delete(id); state.deleted.push(id); },
        removeAllReminders:()=>{ event.reminders=[]; }, addPopupReminder:m=>{ event.reminders.push(m); } };
      events.set(id,event); state.created.push(id);
      return event;
    },
    getEventById:id=>events.get(id) ?? null,
    getEvents:(from,to)=>[...events.values()].filter(e=>e.start<to && e.end>from),
  };
}
export function gmailScript() {
  const rows = [['job_id','payload_hash','status','updated_at']];
  const sheets = new Map();
  const properties = new Map([['MAILER_SECRET','test-gmail-secret-12345678901234567890'],['MAILER_LEDGER_ID','ledger']]);
  const calendarState = { ready:false, events:new Map(), created:[], deleted:[], sheets };
  const state = { quota:100, busy:false, failSend:false, sent:[], rows, properties, calendar:calendarState };
  const sheet = mockSheet(rows);
  const calendar = mockCalendar(calendarState);
  const context = vm.createContext({
    console:{log:()=>{}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
    Utilities:{Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},getUuid:randomUUID,
      computeHmacSha256Signature:(v,k)=>[...createHmac('sha256',k).update(v).digest()],
      computeDigest:(_algorithm,v)=>[...createHash('sha256').update(v).digest()]},
    SpreadsheetApp:{openById:()=>({
      getSheets:()=>[sheet],
      getSheetByName:name=>sheets.get(name) ?? null,
      insertSheet:name=>{ const rowsOf=[]; const created=mockSheet(rowsOf); created.rows=rowsOf; sheets.set(name,created); return created; },
    }),flush:()=>{}},
    LockService:{getScriptLock:()=>({tryLock:()=>!state.busy,hasLock:()=>!state.busy,releaseLock:()=>{}})},
    MailApp:{getRemainingDailyQuota:()=>state.quota,sendEmail:email=>{state.sent.push(email);state.quota--;if(state.failSend)throw new Error('uncertain send');}},
    CalendarApp:{
      getCalendarById:id=>calendarState.ready && id===calendar.getId() ? calendar : null,
      createCalendar:()=>{ calendarState.ready=true; return calendar; },
    },
    Session:{getEffectiveUser:()=>({getEmail:()=>'punkturepiercingstudio@gmail.com'})},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType:()=>({body})})},
  });
  vm.runInContext(readFileSync('backend/apps-script/Code.gs','utf8'), context);
  return {...state, state, setupCalendar:()=>context.setupCalendar(), handle:envelope=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(envelope)}}).body)};
}
