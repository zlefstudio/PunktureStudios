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
export interface PublicSettings {
  key: 'public';
  /** Next pop-up date as YYYY-MM-DD (optional). */
  eventDate?: string;
  /** Venue / location of the next pop-up (optional). */
  eventLocation?: string;
  /** Google Maps (or similar) link shown on the public page (optional). */
  eventMapUrl?: string;
  /** When true and an eventDate exists, the public page advertises the event. */
  eventActive: boolean;
  updatedAt: number;
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
  schemaVersion: 1;
  exportedAt: string;
  tickets: Ticket[];
  items: PiercingItem[];
}
