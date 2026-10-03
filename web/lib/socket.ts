import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let adminSocket: Socket | null = null;

let currentGateId: string | null = null;
let currentClientType: string = 'console';

const adminGateRooms = new Set<string>();

export interface KioskOutputPayload {
  sessionId: string;
  gateId: string;
  state: string;
  message: string;
  audio?: ArrayBuffer;
  inputMode: 'VOICE' | 'BUTTONS' | 'TEXT';
}

export interface KioskInputPayload {
  sessionId: string;
  gateId: string;
  state: string;
  audio?: ArrayBuffer;
  text?: string;
}

/**
 * Main application socket.
 *
 * Used by the existing kiosk / console flows.
 * This connects to the default Socket.IO namespace.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected / Reconnected. Socket ID:', socket?.id);

      if (currentGateId) {
        console.log(
          `[Socket] Re-emitting kiosk.join for gateId: ${currentGateId}, clientType: ${currentClientType}`,
        );

        socket.emit('kiosk.join', {
          gateId: currentGateId,
          clientType: currentClientType,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });
  }

  return socket;
}

/**
 * Join the existing kiosk/console gate room.
 */
export function joinGateRoom(
  gateId: string,
  clientType: 'kiosk' | 'console' | string = 'console',
): void {
  currentGateId = gateId;
  currentClientType = clientType;

  const s = getSocket();

  if (s.connected) {
    console.log(`[Socket] Joining room for gate: ${gateId}, clientType: ${clientType}`);

    s.emit('kiosk.join', {
      gateId,
      clientType,
    });
  }
}

/**
 * Backend → Frontend
 *
 * All kiosk outputs use one Socket.IO event.
 */
export function subscribeToOutput(callback: (data: KioskOutputPayload) => void): () => void {
  const s = getSocket();

  s.on('OUTPUT', callback);

  return () => {
    s.off('OUTPUT', callback);
  };
}

/**
 * Frontend → Backend
 *
 * All kiosk inputs use one Socket.IO event.
 */
export function emitInput(payload: KioskInputPayload): void {
  const s = getSocket();

  console.log('[Socket] Sending INPUT:', {
    sessionId: payload.sessionId,
    gateId: payload.gateId,
    state: payload.state,
    audioBytes: payload.audio?.byteLength ?? 0,
    text: payload.text,
  });

  s.emit('INPUT', payload);
}

/**
 * Backend → Console
 *
 * Notifies the console that the QR check-in display
 * for a gate has changed.
 */
export function subscribeToCheckinDisplay(
  callback: (data: { gateId: string; token: string | null; timestamp: string }) => void,
): () => void {
  const s = getSocket();

  s.on('checkin.display', callback);

  return () => {
    s.off('checkin.display', callback);
  };
}

/**
 * Backend → Console
 *
 * Receives SAP lookup results.
 */
export function subscribeToSapResult(callback: (data: any) => void): () => void {
  const s = getSocket();

  s.on('sap.result', callback);

  return () => {
    s.off('sap.result', callback);
  };
}

/**
 * Backend → Console
 *
 * Receives gate state updates.
 */
export function subscribeToGateState(callback: (data: any) => void): () => void {
  const s = getSocket();

  s.on('gate.state', callback);

  return () => {
    s.off('gate.state', callback);
  };
}

/**
 * Backend → Frontend
 *
 * Receives kiosk state updates.
 */
export function subscribeToKioskState(callback: (data: any) => void): () => void {
  const s = getSocket();

  s.on('kiosk.state', callback);

  return () => {
    s.off('kiosk.state', callback);
  };
}

/**
 * Backend → Admin Dashboard
 *
 * Fires whenever a kiosk socket joins a gate room.
 */
export function subscribeToGateConnected(
  callback: (payload: { gateId: string; connectedAt: string }) => void,
): () => void {
  const s = getSocket();

  s.on('gate.connected', callback);

  return () => {
    s.off('gate.connected', callback);
  };
}

/**
 * Backend → Admin Dashboard
 *
 * Fires whenever a kiosk socket leaves a gate room.
 */
export function subscribeToGateDisconnected(
  callback: (payload: { gateId: string }) => void,
): () => void {
  const s = getSocket();

  s.on('gate.disconnected', callback);

  return () => {
    s.off('gate.disconnected', callback);
  };
}

/* ============================================================
 * ADMIN DASHBOARD SOCKET
 * ============================================================
 *
 * The AdminGateway uses the /gate namespace.
 *
 * This socket is intentionally separate from getSocket()
 * because the existing kiosk/console socket uses the default
 * namespace and must not be changed.
 */

/**
 * Get the Socket.IO connection for the Admin Gateway.
 *
 * Backend:
 * @WebSocketGateway({ namespace: '/gate' })
 */
export function getAdminSocket(): Socket {
  if (!adminSocket) {
    adminSocket = io(`${WS_URL}/gate`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    adminSocket.on('connect', () => {
      console.log('[AdminSocket] Connected. Socket ID:', adminSocket?.id);

      /*
       * Rejoin every gate room after reconnecting.
       */
      adminGateRooms.forEach((gateId) => {
        console.log(`[AdminSocket] Rejoining gate room after reconnect: ${gateId}`);

        adminSocket?.emit('joinGate', {
          gateId,
        });
      });
    });

    adminSocket.on('disconnect', (reason) => {
      console.warn('[AdminSocket] Disconnected:', reason);
    });
  }

  return adminSocket;
}

/**
 * Join an Admin Gateway gate room.
 *
 * Backend event:
 * joinGate
 */
export function joinAdminGateRoom(gateId: string): void {
  if (!gateId) {
    return;
  }

  adminGateRooms.add(gateId);

  const s = getAdminSocket();

  if (s.connected) {
    console.log(`[AdminSocket] Joining gate room: gate:${gateId}`);

    s.emit('joinGate', {
      gateId,
    });
  }
}

/**
 * Leave an Admin Gateway gate room.
 */
export function leaveAdminGateRoom(gateId: string): void {
  if (!gateId) {
    return;
  }

  adminGateRooms.delete(gateId);

  const s = getAdminSocket();

  if (s.connected) {
    console.log(`[AdminSocket] Leaving gate room: gate:${gateId}`);

    s.emit('leaveGate', {
      gateId,
    });
  }
}

/**
 * Admin → Frontend
 *
 * A new ticket was added to a gate queue.
 */
export function subscribeToQueueTicketAdded(
  callback: (payload: { ticket: any }) => void,
): () => void {
  const s = getAdminSocket();

  s.on('QUEUE_TICKET_ADDED', callback);

  return () => {
    s.off('QUEUE_TICKET_ADDED', callback);
  };
}

/**
 * Admin → Frontend
 *
 * A ticket status changed.
 */
export function subscribeToQueueTicketStatusUpdated(
  callback: (payload: { ticketId: string; status: string }) => void,
): () => void {
  const s = getAdminSocket();

  s.on('QUEUE_TICKET_STATUS_UPDATED', callback);

  return () => {
    s.off('QUEUE_TICKET_STATUS_UPDATED', callback);
  };
}
