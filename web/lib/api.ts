const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

/* ============================================================
 * LPR
 * ============================================================
 */

export interface PlateReadRequest {
  plateNo: string;
  gateId: string;
}

export interface PlateReadResponse {
  plateNo: string;
  gateId: string;
  timestamp?: string;
}

/* ============================================================
 * QUEUE / CHECK-IN
 * ============================================================
 */

export type ContactMethod =
  | 'SMS'
  | 'WHATSAPP'
  | 'ELSAAYER_APP'
  | 'CALLING_AGENT';

export type QueueTicketStatus =
  | 'WAITING'
  | 'CALLED'
  | 'ACKNOWLEDGED'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'SKIPPED'
  | 'NO_SHOW';

/**
 * Check-in request sent to the backend.
 *
 * Both property names are supported for compatibility:
 *
 * isToyotaCustomer
 * IsToyotaCustomer
 *
 * They should always contain the same boolean value.
 */
export interface CheckInRequest {
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
  preferredContactMethod: ContactMethod;

  isToyotaCustomer?: boolean;
  IsToyotaCustomer?: boolean;
}

export interface CheckInResponse {
  success: boolean;
  gateOpened: boolean;
  queueEntryId?: string;
  reason?: string;
}

/**
 * Queue ticket returned by the Admin Queue API.
 *
 * Both property names are supported because the backend
 * currently keeps compatibility with both naming styles.
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
  IsToyotaCustomer?: boolean;

  status: QueueTicketStatus;
  createdAt: string;
}

/* ============================================================
 * HEALTH
 * ============================================================
 */

export interface HealthResponse {
  status: string;
  timestamp: string;
  config: {
    activeApproach: string;
    adapters: Record<string, string>;
  };
}

/* ============================================================
 * ADMIN
 * ============================================================
 */

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

/* ============================================================
 * API FUNCTIONS
 * ============================================================
 */

/**
 * POST /lpr/simulate
 */
export async function simulateLprRead(
  plateNo: string,
  gateId: string,
): Promise<PlateReadResponse> {
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
    throw new Error(
      `Failed to simulate LPR read: ${res.statusText}`,
    );
  }

  return res.json();
}

/**
 * POST /checkin/submit
 */
export async function submitCheckIn(
  data: CheckInRequest,
): Promise<CheckInResponse> {
  const res = await fetch(`${API_URL}/checkin/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to submit check-in: ${res.statusText}`,
    );
  }

  return res.json();
}

/**
 * GET /health
 */
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`);

  if (!res.ok) {
    throw new Error(
      `Failed to fetch health: ${res.statusText}`,
    );
  }

  return res.json();
}

/**
 * GET /qr/ticket/:ticketId
 */
export async function getTicketStatus(
  ticketId: string,
): Promise<any> {
  const res = await fetch(
    `${API_URL}/qr/ticket/${ticketId}`,
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ticket: ${res.statusText}`,
    );
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
    throw new Error(
      `Failed to fetch admin queue: ${res.statusText}`,
    );
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
    throw new Error(
      `Failed to fetch admin gates: ${res.statusText}`,
    );
  }

  return res.json();
}