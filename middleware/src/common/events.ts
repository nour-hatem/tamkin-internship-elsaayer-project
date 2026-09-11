export const EVENTS = {
  PLATE_READ: 'lpr.plate_read',
  SAP_LOOKUP_RESULT: 'sap.lookup_result',
  CONFIRMING_PHONE: 'confirming.phone',
  ASKING_ABOUT_PHONE:'asking.phone',
  CHECKIN_REQUEST: 'checkin.request',
  CHECKIN_COMPLETED: 'checkin.completed',
  GATE_OPEN: 'gate.open',
  KIOSK_STATE_CHANGED: 'kiosk.state_changed',
  KIOSK_INPUT: 'KIOSK_INPUT',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];
