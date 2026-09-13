export interface KioskSession {
  sessionId: string;
  gateId: string;
  plateNo: string;
  customerName: string;
  phone: string;
  currentState: string;
  confirmationRetries: number;
  phoneRetries: number;
  socketId?: string | null;
}

export type CreateSessionDto = Omit<KioskSession, 'sessionId' | 'currentState'> & {
  sessionId?: string;
  currentState?: string;
  socketId?: string | null;
};
