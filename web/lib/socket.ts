import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

let socket: Socket | null = null;
let currentGateId: string | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(WS_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    // Reconnect handling: every time connect event fires, re-emit kiosk.join
    socket.on('connect', () => {
      console.log('[Socket] Connected / Reconnected. Socket ID:', socket?.id);
      if (currentGateId) {
        console.log(`[Socket] Re-emitting kiosk.join for gateId: ${currentGateId}`);
        socket.emit('kiosk.join', { gateId: currentGateId });
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });
  }

  return socket;
}

export function joinGateRoom(gateId: string): void {
  currentGateId = gateId;
  const s = getSocket();
  if (s.connected) {
    console.log(`[Socket] Joining room for gate: ${gateId}`);
    s.emit('kiosk.join', { gateId });
  }
}

export function subscribeToSapResult(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on('sap.result', callback);
  return () => {
    s.off('sap.result', callback);
  };
}

export function subscribeToGateState(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on('gate.state', callback);
  return () => {
    s.off('gate.state', callback);
  };
}


export function subscribeToKioskState(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on('kiosk.state', callback);
  return () => {
    s.off('kiosk.state', callback);
  };
}

export function subscribeToSendGreeting(callback: (data: any) => void): () => void {
  const s = getSocket();
  s.on('SEND_GREETING', callback);
  return () => {
    s.off('SEND_GREETING', callback);
  };
}



