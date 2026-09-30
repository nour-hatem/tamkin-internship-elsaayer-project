import { ContactMethod } from 'src/ai';

export interface KioskSession {
  sessionId: string;
  gateId: string;
  plateNo: string;
  customerName: string;
  phone: string;
  currentState: string;
  confirmationRetries: number;
  phoneRetries: number;
  contactMethod?: ContactMethod | null;
  contactMethodRetries?: number;
  socketId?: string | null;
  ToyotaCustomer:boolean
}

export type CreateSessionDto = Omit<KioskSession, 'sessionId' | 'currentState'> & {
  sessionId?: string;
  currentState?: string;
  socketId?: string | null;
};
