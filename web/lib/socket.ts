import { io, Socket } from 'socket.io-client';

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let currentGateId: string | null = null;

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
  text?:string
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log(
        '[Socket] Connected / Reconnected. Socket ID:',
        socket?.id,
      );

      if (currentGateId) {
        console.log(
          `[Socket] Re-emitting kiosk.join for gateId: ${currentGateId}`,
        );

        socket.emit('kiosk.join', {
          gateId: currentGateId,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn(
        '[Socket] Disconnected:',
        reason,
      );
    });
  }

  return socket;
}

export function joinGateRoom(gateId: string): void {
  currentGateId = gateId;

  const s = getSocket();

  if (s.connected) {
    console.log(
      `[Socket] Joining room for gate: ${gateId}`,
    );

    s.emit('kiosk.join', {
      gateId,
    });
  }
}

/**
 * Backend → Frontend
 *
 * All kiosk outputs use one Socket.IO event.
 */
export function subscribeToOutput(
  callback: (data: KioskOutputPayload) => void,
): () => void {
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
export function emitInput(
  payload: KioskInputPayload,
): void {
  const s = getSocket();

  console.log(
    '[Socket] Sending INPUT:',
    {
      sessionId: payload.sessionId,
      gateId: payload.gateId,
      state: payload.state,
      audioBytes: payload.audio?.byteLength ?? 0,
      text: payload.text,
    },
  );

  s.emit('INPUT', payload);
}

// --------------------------------------------------
// Existing general events
// --------------------------------------------------

export function subscribeToSapResult(
  callback: (data: any) => void,
): () => void {
  const s = getSocket();

  s.on('sap.result', callback);

  return () => {
    s.off('sap.result', callback);
  };
}

export function subscribeToGateState(
  callback: (data: any) => void,
): () => void {
  const s = getSocket();

  s.on('gate.state', callback);

  return () => {
    s.off('gate.state', callback);
  };
}

export function subscribeToKioskState(
  callback: (data: any) => void,
): () => void {
  const s = getSocket();

  s.on('kiosk.state', callback);

  return () => {
    s.off('kiosk.state', callback);
  };
}