/* Paste this whole file into Code.gs in a new Google Apps Script project.
 * Run setupMailer once, then deploy as a Web app: Execute as Me; access Anyone.
 * Requests still require HMAC authentication. Never share MAILER_SECRET.
 * For Google Calendar sync, also run setupCalendar once (see docs/gmail-setup.md).
 */
var CALENDAR_NAME = 'Punkture Bookings';
var CALENDAR_TAG = 'punktureBookingId';
function setupMailer() {
  var properties = PropertiesService.getScriptProperties();
  // Request mail authorization during setup, without sending an email.
  MailApp.getRemainingDailyQuota();
  if (!properties.getProperty('MAILER_SECRET')) {
    properties.setProperty('MAILER_SECRET', Utilities.getUuid() + Utilities.getUuid());
  }
  if (!properties.getProperty('MAILER_LEDGER_ID')) {
    var book = SpreadsheetApp.create('Punkture email delivery ledger — private');
    book.getSheets()[0].appendRow(['job_id', 'payload_hash', 'status', 'updated_at']);
    properties.setProperty('MAILER_LEDGER_ID', book.getId());
  }
  console.log('Setup complete. Open Project Settings → Script properties to copy MAILER_SECRET. No email was sent.');
}
/* Creates (once) the calendar that receives paid bookings, plus a private
 * booking → event index sheet inside the existing delivery ledger.
 * Run it from the editor after setupMailer; it creates no events. */
function setupCalendar() {
  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('MAILER_LEDGER_ID')) throw new Error('Run setupMailer first.');
  var calendar = calendarOf_(props);
  if (!calendar) {
    calendar = CalendarApp.createCalendar(CALENDAR_NAME, { timeZone: 'Asia/Manila', summary: 'Paid online bookings, added automatically by the Punkture booking system.' });
    props.setProperty('CALENDAR_ID', calendar.getId());
  }
  calendarSheet_(props);
  console.log('Calendar ready: "' + calendar.getName() + '" in the Google account ' + Session.getEffectiveUser().getEmail() + '. No events were created.');
}
function calendarOf_(props) {
  var id = props.getProperty('CALENDAR_ID');
  return id ? CalendarApp.getCalendarById(id) : null;
}
function calendarSheet_(props) {
  var book = SpreadsheetApp.openById(props.getProperty('MAILER_LEDGER_ID'));
  var sheet = book.getSheetByName('calendar');
  if (!sheet) {
    sheet = book.insertSheet('calendar');
    sheet.appendRow(['booking_id', 'event_id', 'status', 'updated_at']);
  }
  return sheet;
}
function validCalendar_(m) {
  return /^[a-zA-Z0-9:_-]{1,160}$/.test(m.id || '') && (m.action === 'upsert' || m.action === 'remove')
    && /^[a-zA-Z0-9-]{1,80}$/.test(m.bookingId || '') && /^\d{4}-\d{2}-\d{2}$/.test(m.date || '') && /^([01]\d|2[0-3]):[0-5]\d$/.test(m.time || '')
    && Number.isInteger(m.minutes) && m.minutes >= 15 && m.minutes <= 240
    && typeof m.title === 'string' && m.title.length > 0 && m.title.length <= 200 && !/[\r\n]/.test(m.title)
    && typeof m.description === 'string' && m.description.length <= 8000
    && Array.isArray(m.reminders) && m.reminders.length <= 5 && m.reminders.every(function(r) { return Number.isInteger(r) && r >= 0 && r <= 40320; });
}
/* Idempotent: "upsert" adds the event only when it is missing (staff edits in
 * Calendar are kept); "remove" deletes it if present. Events are found through
 * the index sheet, or by their private tag when the index write was interrupted. */
function applyCalendar_(m, props) {
  var calendar = calendarOf_(props);
  if (!calendar) return { error: 'calendar_not_configured' };
  var sheet = calendarSheet_(props);
  var start = new Date(m.date + 'T' + m.time + ':00+08:00');
  var end = new Date(start.getTime() + m.minutes * 60000);
  var lastRow = sheet.getLastRow();
  var cell = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(m.bookingId).matchEntireCell(true).findNext() : null;
  var row = cell ? cell.getRow() : lastRow + 1;
  var event = null;
  if (cell) {
    var eventId = sheet.getRange(row, 1, 1, 4).getValues()[0][1];
    if (eventId) event = calendar.getEventById(eventId);
  }
  if (!event) {
    var nearby = calendar.getEvents(new Date(start.getTime() - 86400000), new Date(end.getTime() + 86400000));
    for (var i = 0; i < nearby.length && !event; i++) if (nearby[i].getTag(CALENDAR_TAG) === m.bookingId) event = nearby[i];
  }
  if (m.action === 'remove') {
    if (event) event.deleteEvent();
    sheet.getRange(row, 1, 1, 4).setValues([[m.bookingId, '', 'removed', new Date().toISOString()]]);
  } else {
    if (!event) {
      event = calendar.createEvent(m.title, start, end, { description: m.description });
      event.setTag(CALENDAR_TAG, m.bookingId);
      event.removeAllReminders();
      m.reminders.forEach(function(minutes) { event.addPopupReminder(minutes); });
    }
    sheet.getRange(row, 1, 1, 4).setValues([[m.bookingId, event.getId(), 'added', new Date().toISOString()]]);
  }
  SpreadsheetApp.flush();
  return { status: 'sent', id: m.id };
}
function mailerReply_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function hex_(bytes) {
  return bytes.map(function(b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
function doGet() {
  return mailerReply_({ service: 'Punkture Gmail mailer', status: 'ready_for_signed_requests' });
}
function doPost(e) {
  var lock;
  try {
    var raw = e && e.postData && e.postData.contents;
    if (typeof raw !== 'string' || raw.length > 24000) return mailerReply_({ error: 'invalid_request' });
    var envelope = JSON.parse(raw);
    var props = PropertiesService.getScriptProperties();
    var secret = props.getProperty('MAILER_SECRET');
    var ledgerId = props.getProperty('MAILER_LEDGER_ID');
    if (!secret || secret.length < 32 || !ledgerId) return mailerReply_({ error: 'not_configured' });
    if (!Number.isInteger(envelope.timestamp) || Math.abs(Date.now()/1000 - envelope.timestamp) > 300 || typeof envelope.payload !== 'string' || !/^[a-f0-9]{64}$/.test(envelope.signature || '')) return mailerReply_({ error: 'unauthorized' });
    var expected = hex_(Utilities.computeHmacSha256Signature(envelope.timestamp + '.' + envelope.payload, secret, Utilities.Charset.UTF_8));
    var difference = 0;
    for (var i = 0; i < 64; i++) difference |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
    if (difference !== 0) return mailerReply_({ error: 'unauthorized' });
    var m = JSON.parse(envelope.payload);
    if (m && m.type === 'calendar') {
      if (!validCalendar_(m)) return mailerReply_({ error: 'invalid_request' });
      lock = LockService.getScriptLock();
      if (!lock.tryLock(5000)) return mailerReply_({ error: 'busy' });
      return mailerReply_(applyCalendar_(m, props));
    }
    if (!/^[a-zA-Z0-9:_-]{1,160}$/.test(m.id || '') || typeof m.to !== 'string' || m.to.length > 254 || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(m.to) || typeof m.subject !== 'string' || /[\r\n]/.test(m.subject) || !m.subject.startsWith('Punkture Studios:') || m.subject.length > 250 || typeof m.text !== 'string' || m.text.length > 16000) return mailerReply_({ error: 'invalid_request' });
    lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return mailerReply_({ error: 'busy' });
    var sheet = SpreadsheetApp.openById(ledgerId).getSheets()[0];
    var hash = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, envelope.payload, Utilities.Charset.UTF_8));
    var lastRow = sheet.getLastRow();
    var cell = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).createTextFinder(m.id).matchEntireCell(true).findNext() : null;
    if (cell) {
      var existing = sheet.getRange(cell.getRow(), 1, 1, 4).getValues()[0];
      if (existing[1] !== hash || existing[2] !== 'sent') return mailerReply_({ status: 'needs_review', id: m.id });
      return mailerReply_({ status: 'sent', id: m.id });
    }
    // Check quota BEFORE claiming delivery. Quota exhaustion is safe to retry later.
    if (MailApp.getRemainingDailyQuota() < 1) return mailerReply_({ error: 'quota_exhausted' });
    // Durable intent before send: if execution stops during send, never blindly send twice.
    var row = lastRow + 1;
    sheet.getRange(row, 1, 1, 4).setValues([[m.id, hash, 'sending', new Date().toISOString()]]);
    SpreadsheetApp.flush();
    try {
      MailApp.sendEmail({ to: m.to, subject: m.subject, body: m.text, name: 'Punkture Studios' });
      sheet.getRange(row, 3, 1, 2).setValues([['sent', new Date().toISOString()]]);
      SpreadsheetApp.flush();
      return mailerReply_({ status: 'sent', id: m.id });
    } catch (_sendError) {
      // MailApp has no provider idempotency API. A send exception may be ambiguous.
      // Keep the intent row; customer and admin jobs are reviewed independently.
      return mailerReply_({ status: 'needs_review', id: m.id });
    }
  } catch (_error) {
    return mailerReply_({ error: 'bridge_unavailable' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}
