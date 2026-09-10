import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { CheckInResultDto } from '../common/dtos/checkin-result.dto';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class KioskGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KioskGateway.name);

  constructor(private readonly configService: ConfigService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Socket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket client disconnected: ${client.id}`);
  }

  @SubscribeMessage('kiosk.join')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gateId: string },
  ) {
    const gateId = data?.gateId || 'gate-1';
    const roomName = `gate:${gateId}`;

    client.join(roomName);

    this.logger.log(`Client ${client.id} joined room ${roomName}`);

    const activeApproach = this.configService.get<string>(
      'ACTIVE_APPROACH',
      'voice',
    );

    client.emit('kiosk.state', {
      gateId,
      status: 'JOINED_ROOM',
      activeApproach,
      timestamp: new Date().toISOString(),
    });

    return { event: 'kiosk.joined', gateId };
  }

  @OnEvent(EVENTS.CHECKIN_DISPLAY_UPDATED)
  handleCheckinDisplayUpdated(payload: {
    gateId: string;
    token: string;
  }) {
    const roomName = `gate:${payload.gateId}`;

    this.logger.log(
      `Broadcasting check-in display update to ${roomName}`,
    );

    this.server.to(roomName).emit('checkin.display', {
      gateId: payload.gateId,
      token: payload.token,
      timestamp: new Date().toISOString(),
    });
  }

  @OnEvent(EVENTS.SAP_LOOKUP_RESULT)
  handleSapLookup(payload: SapLookupResultDto) {
    this.logger.log(
      `Broadcasting SAP result to gate rooms for plate: ${payload.plate}`,
    );

    this.server.emit('sap.result', payload);
  }

  @OnEvent(EVENTS.CHECKIN_COMPLETED)
  handleCheckInCompleted(payload: CheckInResultDto) {
    this.logger.log(
      `Broadcasting Gate/Check-in state update: opened=${payload.gateOpened}`,
    );

    this.server.emit('gate.state', payload);
  }
}