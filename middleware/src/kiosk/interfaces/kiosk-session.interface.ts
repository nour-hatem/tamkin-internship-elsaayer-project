export interface KioskSession {
  sessionId: string;
  gateId: string;
  plateNo: string;
  customerName: string;
  phone: string;
  currentState: string;
}

export type CreateSessionDto = Omit<KioskSession, 'sessionId' | 'currentState'> & {
  sessionId?: string;
  currentState?: string;
};
