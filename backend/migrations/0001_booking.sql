CREATE TABLE bookings (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, request_hash TEXT NOT NULL,
 name TEXT NOT NULL, email TEXT NOT NULL, contact TEXT NOT NULL, notes TEXT NOT NULL,
 date TEXT NOT NULL, time TEXT NOT NULL, requestedFor INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('creating','pending','confirmed','expired','payment_review','cancelled')),
 createdAt INTEGER NOT NULL, expiresAt INTEGER NOT NULL, paidAt INTEGER,
 session_id TEXT UNIQUE, checkout_url TEXT, payment_id TEXT UNIQUE,
 amount INTEGER NOT NULL DEFAULT 10000 CHECK(amount=10000), currency TEXT NOT NULL DEFAULT 'PHP' CHECK(currency='PHP'),
 policy TEXT NOT NULL, lastCheckAt INTEGER NOT NULL DEFAULT 0, last_error TEXT
);
CREATE UNIQUE INDEX one_booking_per_slot ON bookings(date,time) WHERE status IN ('creating','pending','confirmed');
CREATE INDEX booking_expiry ON bookings(status,expiresAt);
CREATE INDEX booking_created ON bookings(createdAt);
CREATE TABLE webhook_events(id TEXT PRIMARY KEY, booking_id TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE outbox (
 id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id), audience TEXT NOT NULL,
 kind TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 createdAt INTEGER NOT NULL, nextAt INTEGER NOT NULL, leaseUntil INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT, last_error TEXT
);
CREATE INDEX outbox_due ON outbox(status,nextAt);
CREATE TRIGGER booking_notification AFTER UPDATE OF status ON bookings
WHEN NEW.status IN ('confirmed','payment_review','cancelled') AND NEW.status != OLD.status
BEGIN
 INSERT OR IGNORE INTO outbox(id,booking_id,audience,kind,createdAt,nextAt) VALUES(NEW.id||':'||NEW.status||':customer',NEW.id,'customer',NEW.status,unixepoch()*1000,0);
 INSERT OR IGNORE INTO outbox(id,booking_id,audience,kind,createdAt,nextAt) VALUES(NEW.id||':'||NEW.status||':admin',NEW.id,'admin',NEW.status,unixepoch()*1000,0);
END;
CREATE TABLE rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expiresAt INTEGER NOT NULL);
CREATE TABLE audit (id INTEGER PRIMARY KEY, booking_id TEXT, action TEXT NOT NULL, createdAt INTEGER NOT NULL);
CREATE TABLE legacy_holds (id TEXT PRIMARY KEY, date TEXT NOT NULL, time TEXT NOT NULL);
CREATE INDEX legacy_slot ON legacy_holds(date,time);
CREATE TABLE deployment_checks (id TEXT PRIMARY KEY, completedAt INTEGER NOT NULL);
CREATE TRIGGER legacy_slot_guard BEFORE INSERT ON bookings
WHEN EXISTS(SELECT 1 FROM legacy_holds WHERE date=NEW.date AND time=NEW.time)
BEGIN SELECT RAISE(ABORT, 'UNIQUE legacy slot occupied'); END;
CREATE TRIGGER legacy_import_guard BEFORE INSERT ON legacy_holds
WHEN EXISTS(SELECT 1 FROM bookings WHERE date=NEW.date AND time=NEW.time AND status IN ('creating','pending','confirmed'))
BEGIN SELECT RAISE(ABORT, 'Legacy import conflicts with an active payment booking'); END;
