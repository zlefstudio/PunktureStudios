import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
export function gmailScript() {
  const rows = [['job_id','payload_hash','status','updated_at']];
  const properties = new Map([['MAILER_SECRET','test-gmail-secret-12345678901234567890'],['MAILER_LEDGER_ID','ledger']]);
  const state = { quota:100, busy:false, failSend:false, sent:[], rows, properties };
  const sheet = {
    getLastRow:()=>rows.length,
    getRange:(row,col,count=1)=>({
      setValues:values=>values.forEach((v,i)=> { rows[row-1+i] ??= []; v.forEach((x,j)=>{rows[row-1+i][col-1+j]=x;}); }),
      getValues:()=>rows.slice(row-1,row-1+count).map(r=>r.slice(col-1,col+3)),
      createTextFinder:id=>({ matchEntireCell:()=>({ findNext:()=> { const index=rows.findIndex((r,i)=>i>=row-1&&r[col-1]===id);return index<0?null:{getRow:()=>index+1}; } }) }),
    }),
  };
  const context = vm.createContext({
    console:{log:()=>{}},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k),setProperty:(k,v)=>properties.set(k,v)})},
    Utilities:{Charset:{UTF_8:'utf8'},DigestAlgorithm:{SHA_256:'sha256'},getUuid:randomUUID,
      computeHmacSha256Signature:(v,k)=>[...createHmac('sha256',k).update(v).digest()],
      computeDigest:(_algorithm,v)=>[...createHash('sha256').update(v).digest()]},
    SpreadsheetApp:{openById:()=>({getSheets:()=>[sheet]}),flush:()=>{}},
    LockService:{getScriptLock:()=>({tryLock:()=>!state.busy,hasLock:()=>!state.busy,releaseLock:()=>{}})},
    MailApp:{getRemainingDailyQuota:()=>state.quota,sendEmail:email=>{state.sent.push(email);state.quota--;if(state.failSend)throw new Error('uncertain send');}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:body=>({setMimeType:()=>({body})})},
  });
  vm.runInContext(readFileSync('backend/apps-script/Code.gs','utf8'), context);
  return {...state, state, handle:envelope=>JSON.parse(context.doPost({postData:{contents:JSON.stringify(envelope)}}).body)};
}
