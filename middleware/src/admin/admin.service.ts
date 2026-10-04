import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EVENTS } from 'src/common/events';
import { QueueService, QueueTicket } from 'src/queue/queue.service';

export interface GateInfo {
  id: string;
  name: string;
  location: string;
  gateId: string;
  socketId: string;
  connectedAt: Date;
}

export type GateEntry = GateInfo;

function formatGateName(gateId: string): string {
  const match = gateId.match(/^gate[-_]?(\d+)$/i);
  if (match) {
    return `Gate ${match[1]}`;
  }
  if (/^\d+$/.test(gateId)) {
    return `Gate ${gateId.padStart(2, '0')}`;
  }
  return gateId.charAt(0).toUpperCase() + gateId.slice(1);
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private readonly connectedGates = new Map<
    string,
    { socketId: string; connectedAt: Date }
  >();

  constructor(private readonly queueService: QueueService) {}

  @OnEvent(EVENTS.GATE_CONNECTED)
  handleGateConnected(payload: {
    gateId: string;
    socketId: string;
    timestamp: Date;
  }): void {
    this.connectedGates.set(payload.gateId, {
      socketId: payload.socketId,
      connectedAt: payload.timestamp,
    });
    this.logger.log(
      `Gate connected: gateId=${payload.gateId} socketId=${payload.socketId}`,
    );
  }

  @OnEvent(EVENTS.GATE_DISCONNECTED)
  handleGateDisconnected(payload: {
    gateId: string;
    socketId: string;
    timestamp: Date;
  }): void {
    this.connectedGates.delete(payload.gateId);
    this.logger.log(
      `Gate disconnected: gateId=${payload.gateId} socketId=${payload.socketId}`,
    );
  }

  getConnectedGates(): GateInfo[] {
    return Array.from(this.connectedGates.entries()).map(
      ([gateId, meta]) => ({
        id: gateId,
        gateId,
        name: formatGateName(gateId),
        location: '',
        socketId: meta.socketId,
        connectedAt: meta.connectedAt,
      }),
    );
  }

  async getGateQueue(gateId: string): Promise<QueueTicket[]> {
    const all = await this.queueService.getAllTickets();
    return all.filter((t) => t.gateId === gateId);
  }

  async getFullQueue(): Promise<QueueTicket[]> {
    return this.queueService.getAllTickets();
  }

}
