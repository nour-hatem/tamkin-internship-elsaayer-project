export type GateStatus = "CONNECTED" | "OFFLINE";

export type CustomerType = "TOYOTA_CUSTOMER" | "NEW_CUSTOMER";

export type CustomerStatus =
  | "WAITING"
  | "IN_SERVICE"
  | "COMPLETED";

export type ActivityStatus =
  | "SUCCESS"
  | "WARNING"
  | "ERROR"
  | "INFO";

export interface Gate {
  id: string;
  name: string;
  location: string;
  status: GateStatus;
  waitingCount: number;
  currentTicket?: string;
  currentCustomerId?: string;

  services: {
    lpr: boolean;
    sap: boolean;
    queueEngine: boolean;
    voiceAssistant: boolean;
    notifications: boolean;
    redis: boolean;
  };
}



export interface ActivityLog {
  id: string;
  timestamp: string;
  gateId: string;
  event: string;
  description: string;
  status: ActivityStatus;
}

export interface AnalyticsData {
  totalCheckIns: number;
  completedCheckIns: number;
  averageWaitTime: string;
  averageServiceTime: string;
  gateUtilization: number;
}

export type QueueTicketStatus =
  'WAITING' | 'CALLED' | 'ACKNOWLEDGED' | 'IN_SERVICE' | 'COMPLETED' | 'SKIPPED';

  export interface QueueTicket {
  ticketId: string;
  queueNumber: number;
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: "QR" | "VOICE";
  //preferredContactMethod: ContactMethod;
  status: QueueTicketStatus;
  createdAt: string;
}