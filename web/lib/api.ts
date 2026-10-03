const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export interface PlateReadRequest {
  plateNo: string;
  gateId: string;
}

export interface PlateReadResponse {
  plateNo: string;
  gateId: string;
  timestamp?: string;
}

export type ContactMethod = 'SMS' | 'WHATSAPP' | 'ELSAAYER_APP' | 'CALLING_AGENT';

export type QueueTicketStatus =
  'WAITING' | 'CALLED' | 'ACKNOWLEDGED' | 'IN_SERVICE' | 'COMPLETED' | 'SKIPPED' | 'NO_SHOW';

export interface CheckInRequest {
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod: ContactMethod;
}

export interface CheckInResponse {
  success: boolean;
  gateOpened: boolean;
  queueEntryId?: string;
  reason?: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  config: {
    activeApproach: string;
    adapters: Record<string, string>;
  };
}

/**
 * Queue ticket returned by the Admin Queue API.
 */
export interface QueueTicket {
  ticketId: string;
  queueNumber: number;
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod: ContactMethod;
  isToyotaCustomer: boolean;
  status: QueueTicketStatus;
  createdAt: string;
}

/**
 * Connected gate returned by the Admin Gates API.
 */
export interface AdminGate {
  id: string;
  name: string;
  location: string;
  gateId: string;
  socketId: string;
  connectedAt: string;
}

export async function simulateLprRead(plateNo: string, gateId: string): Promise<PlateReadResponse> {
  const res = await fetch(`${API_URL}/lpr/simulate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plateNo,
      gateId,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to simulate LPR read: ${res.statusText}`);
  }

  return res.json();
}

export async function submitCheckIn(data: CheckInRequest): Promise<CheckInResponse> {
  const res = await fetch(`${API_URL}/checkin/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Failed to submit check-in: ${res.statusText}`);
  }

  return res.json();
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);

  if (!res.ok) {
    throw new Error(`Failed to fetch health: ${res.statusText}`);
  }

  return res.json();
}

export async function getTicketStatus(ticketId: string): Promise<any> {
  const res = await fetch(`${API_URL}/qr/ticket/${ticketId}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch ticket: ${res.statusText}`);
  }

  return res.json();
}

/* ============================================================
 * ADMIN DASHBOARD API
 * ============================================================
 */

/**
 * GET /admin/queue
 *
 * Returns the complete queue history across all gates.
 */
export async function getAdminQueue(): Promise<{
  tickets: QueueTicket[];
}> {
  const res = await fetch(`${API_URL}/admin/queue`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch admin queue: ${res.statusText}`);
  }

  return res.json();
}

/**
 * GET /admin/gates
 *
 * Returns all currently connected gates.
 */
export async function getAdminGates(): Promise<{
  gates: AdminGate[];
}> {
  const res = await fetch(`${API_URL}/admin/gates`, {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch admin gates: ${res.statusText}`);
  }

  return res.json();
}
