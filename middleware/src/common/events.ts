export const EVENTS = {
  PLATE_READ: 'lpr.plate_read',
  SAP_LOOKUP_RESULT: 'sap.lookup_result',

  CHECKIN_REQUEST: 'checkin.request',
  CHECKIN_SUBMITTED: 'checkin.submitted',
  CHECKIN_COMPLETED: 'checkin.completed',
  CHECKIN_DISPLAY_UPDATED: 'checkin.display.updated',

  GATE_OPEN: 'gate.open',
  KIOSK_STATE_CHANGED: 'kiosk.state_changed',
  KIOSK_INPUT: 'KIOSK_INPUT',
  CONTACT_ACK: 'queue.contact.ack',
  CONTACT_TIMEOUT: 'queue.contact.timeout',

  GATE_CONNECTED: 'gate.connected',
  GATE_DISCONNECTED: 'gate.disconnected',
  QUEUE_UPDATED: 'queue.updated',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
