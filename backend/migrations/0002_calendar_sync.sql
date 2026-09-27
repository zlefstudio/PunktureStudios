-- Google Calendar sync: one outbox job per confirmation/cancellation, created in
-- the same transaction as the status change (like the email jobs in 0001).
-- The Worker reads the booking's current status when it delivers the job, so a
-- late "confirmed" job can never re-add an event for a cancelled booking.
CREATE TRIGGER booking_calendar AFTER UPDATE OF status ON bookings
WHEN NEW.status IN ('confirmed','cancelled') AND NEW.status != OLD.status
BEGIN
 INSERT OR IGNORE INTO outbox(id,booking_id,audience,kind,createdAt,nextAt) VALUES(NEW.id||':'||NEW.status||':calendar',NEW.id,'calendar',NEW.status,unixepoch()*1000,0);
END;
