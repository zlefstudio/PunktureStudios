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
