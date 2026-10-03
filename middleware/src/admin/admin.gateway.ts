import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { QueueSlotStatus, QueueTicket, QueueTicketStatus } from '../queue/queue.service';
import { EVENTS } from '../common/events';

@WebSocketGateway({
  namespace: '/gate',
  cors: {
    origin: '*',
  },
})
export class AdminGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AdminGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`[AdminGateway] Socket connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[AdminGateway] Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinGate')
  handleJoinGate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gateId: string },
  ) {
    const gateId = data?.gateId || 'gate-1';
    const roomName = `gate:${gateId}`;
    client.join(roomName);
    this.logger.log(
      `[AdminGateway] Client ${client.id} joined room ${roomName}`,
    );
    return { event: 'joined', gateId };
  }

  @SubscribeMessage('leaveGate')
  handleLeaveGate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gateId: string },
  ) {
    const gateId = data?.gateId;
    if (gateId) {
      const roomName = `gate:${gateId}`;
      client.leave(roomName);
      this.logger.log(
        `[AdminGateway] Client ${client.id} left room ${roomName}`,
      );
    }
    return { event: 'left', gateId };
  }

  @OnEvent(EVENTS.QUEUE_TICKET_ADDED)
  handleQueueTicketAdded(payload: { ticket: QueueTicket }) {
    if (!payload?.ticket) return;
    const roomName = `gate:${payload.ticket.gateId}`;
    this.logger.log(
      `[AdminGateway] Broadcasting QUEUE_TICKET_ADDED to ${roomName} for ticket ${payload.ticket.ticketId}`,
    );
    this.server.to(roomName).emit('QUEUE_TICKET_ADDED', {
      ticket: payload.ticket,
    });
  }

  @OnEvent(EVENTS.QUEUE_TICKET_STATUS_UPDATED)
  handleQueueTicketStatusUpdated(payload: {
    ticketId: string;
    gateId: string;
    status: QueueTicketStatus;
  }) {
    if (!payload?.gateId) return;
    const roomName = `gate:${payload.gateId}`;
    this.logger.log(
      `[AdminGateway] Broadcasting QUEUE_TICKET_STATUS_UPDATED to ${roomName}: ticket ${payload.ticketId} -> ${payload.status}`,
    );
    this.server.to(roomName).emit('QUEUE_TICKET_STATUS_UPDATED', {
      ticketId: payload.ticketId,
      status: payload.status,
    });
  }

  @OnEvent(EVENTS.SLOT_STATUS_UPDATED)
  handleSlotStatusUpdated(payload:{
    status:QueueSlotStatus
  }){
    this.logger.log(
      `[AdminGateway] Broadcasting SLOT_STATUS_UPDATED to th server`,
    );
    this.server.emit('SLOT_STATUS_UPDATED',{
      status:payload.status
    })
  }
}
