export type TicketStatus =
  | 'waiting'
  | 'called'
  | 'in_progress'
  | 'finished'
  | 'cancelled';

export interface Ticket {
  id: string;
  ticketNumber: number;
  name: string;
  status: TicketStatus;
  notes?: string;
  createdAt: number; // epoch ms
  /** Last-modified epoch ms. Backfilled for legacy rows; enables future cloud sync diffing. */
  updatedAt: number;
  /** Set by "Reset #1". Records are archived (kept for reports), never deleted. */
  archivedAt?: number;
  /**
   * Manual position inside the WAITING queue (0 = front of the line).
   * Lower values are served first. Set by drag-and-drop reordering.
   */
  queueOrder?: number;
  calledAt?: number;
  startedAt?: number;
  finishedAt?: number;
  cancelledAt?: number;
}

export interface PiercingItem {
  id: string;
  ticketId: string;
  memberLabel?: string;
  placementName: string;
  basePrice: number;
  upgradeLabel: string;
  upgradePrice: number;
  quantity: number;
  createdAt: number;
  /** Last-modified epoch ms. Backfilled for legacy rows; enables future cloud sync diffing. */
  updatedAt: number;
}

/**
 * Public page settings (edited by staff in the 🌐 Public tab, mirrored to the
 * Firestore `public` doc so the public live page / booking page can read it).
 */
export interface PopupEvent {
  id: string;
  eventDate: string;
  eventEndDate?: string;
  eventTitle: string;
  eventHours: string;
  eventLocation: string;
  eventMapUrl: string;
  eventActive: boolean;
}
export interface PublicSettings {
  /** Up to 12 events; an empty list intentionally clears legacy event advertising. */
  events?: PopupEvent[];
  key: 'public';
  /** Next pop-up date as YYYY-MM-DD (optional). */
  eventDate?: string;
  eventEndDate?: string;
  /** Venue / location of the next pop-up (optional). */
  eventLocation?: string;
  /** Google Maps (or similar) link shown on the public page (optional). */
  eventMapUrl?: string;
  /** Optional "save the date" headline override (default: "Next pop-up coming soon"). */
  eventTitle?: string;
  /** Optional event hours, e.g. "10:00 AM – 8:00 PM". */
  eventHours?: string;
  /** Home studio name (shown when no pop-up is active). */
  studioName?: string;
  /** Home studio address (shown when no pop-up is active). */
  studioAddress?: string;
  /** Home studio Google Maps link. */
  studioMapUrl?: string;
  /** When true and an eventDate exists, the public page advertises the event. */
  eventActive: boolean;
  /** When false, public appointment requests are paused. Defaults to true. */
  bookingEnabled?: boolean;
  /** Allowed days of week for bookings [0 = Sunday, 1 = Monday, ... 6 = Saturday]. */
  bookingDays?: number[];
  /** Allowed booking time slots, e.g. ['13:00', '14:30', '16:00', '17:30', '19:00']. */
  bookingSlots?: string[];
  /** Blackout dates when studio is unavailable, e.g. ['2026-09-15']. */
  blockedDates?: string[];
  /** Minimum days in advance to book (default: 1). */
  bookingNoticeDays?: number;
  updatedAt: number;
}

export interface BookingSelectedPiercing {
  id: string; // unique selection id
  name: string;
  category: PlacementCategory;
  basePrice: number;
  upgradeLabel?: string;
  upgradePrice?: number;
  side?: 'left' | 'right' | 'both';
  notes?: string;
  isCustom?: boolean;
  customNotes?: string;
  anatomyDependent?: boolean;
}

// --- Catalog types ---

export type PlacementCategory = 'EAR' | 'ORAL' | 'FACE' | 'BODY' | 'CUSTOM' | 'JEWELRY';

export interface PlacementEntry {
  name: string;
  basePrice: number;
  category: PlacementCategory;
}

export interface UpgradeOption {
  label: string;
  price: number;
}

// --- Backup ---

export interface BackupPayload {
  schemaVersion: 1 | 2;
  exportedAt: string;
  tickets: Ticket[];
  items: PiercingItem[];
  ticketCounter?: number;
  settings?: PublicSettings | null;
}

/** Server-authoritative D1 booking; no client writes may confirm payment. */
export interface PaymentBooking {
  id: string;
  status: 'creating' | 'pending' | 'confirmed' | 'expired' | 'payment_review' | 'cancelled';
  date: string;
  time: string;
  expiresAt: number;
  amount: number;
  currency: string;
  payment_id: string | null;
  paidAt: number | null;
  policy: string;
  checkout_url: string | null;
  last_error?: string | null;
  emails?: { kind: string; status: string }[];
}
