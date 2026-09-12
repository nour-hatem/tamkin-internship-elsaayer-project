export const EVENTS = {
  PLATE_READ: 'lpr.plate_read',
  SAP_LOOKUP_RESULT: 'sap.lookup_result',

  CHECKIN_REQUEST: 'checkin.request',
  CHECKIN_SUBMITTED: 'checkin.submitted',
  CHECKIN_DISPLAY_UPDATED: 'checkin.display.updated',
  CHECKIN_COMPLETED: 'checkin.completed',

  GATE_OPEN: 'gate.open',
  KIOSK_STATE_CHANGED: 'kiosk.state_changed',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];