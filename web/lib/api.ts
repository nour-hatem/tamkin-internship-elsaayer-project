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

export interface CheckInRequest {
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: 'QR' | 'VOICE';
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

export async function simulateLprRead(plateNo: string, gateId: string): Promise<PlateReadResponse> {
  const res = await fetch(`${API_URL}/lpr/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plateNo, gateId }),
  });
  if (!res.ok) {
    throw new Error(`Failed to simulate LPR read: ${res.statusText}`);
  }
  return res.json();
}

export async function submitCheckIn(data: CheckInRequest): Promise<CheckInResponse> {
  const res = await fetch(`${API_URL}/checkin/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
