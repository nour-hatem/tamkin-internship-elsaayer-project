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
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { CheckInResultDto } from '../common/dtos/checkin-result.dto';
import { KioskStateEnum } from './enum/VoiceStateEnum';
import { SessionService } from './session.service';
import { KioskOutputDto } from './interfaces/KioskOutputDto';
import { KioskInputDto } from './interfaces/KioskInputDto';

type SendGreetingDTO = {
  sessionId: string;
  state: KioskStateEnum;
  message: string;
  audio: Buffer;
  gateId: string;
};

@WebSocketGateway({
  namespace: '/kiosk',
  cors: {
    origin: '*',
  },
})
export class KioskGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KioskGateway.name);
  private readonly gateKioskSockets = new Map<string, string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly sessionService: SessionService,
  ) {}

  getKioskSocketIdForGate(gateId: string): string | null {
    return this.gateKioskSockets.get(gateId) || null;
  }

  handleConnection(client: Socket) {
    this.logger.log(`Socket client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Socket client disconnected: ${client.id}`);

    for (const [gateId, socketId] of this.gateKioskSockets.entries()) {
      if (socketId === client.id) {
        this.gateKioskSockets.delete(gateId);

        this.eventEmitter.emit(EVENTS.GATE_DISCONNECTED, {
          gateId,
          socketId: client.id,
          timestamp: new Date(),
        });

        this.logger.log(
          `Unregistered kiosk socket ${client.id} for gate ${gateId}`,
        );
      }
    }
  }

  @SubscribeMessage('kiosk.join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      gateId: string;
      clientType?: string;
      role?: string;
    },
  ) {
    const gateId = data?.gateId || 'gate-1';
    const clientType = data?.clientType || data?.role || 'console';
    const roomName = `gate:${gateId}`;

    // Leave any other gate rooms the client is currently in
    for (const room of client.rooms) {
      if (room.startsWith('gate:') && room !== roomName) {
        client.leave(room);

        this.logger.log(
          `Client ${client.id} left previous room ${room}`,
        );
      }
    }

    client.join(roomName);

    this.logger.log(
      `Client ${client.id} (${clientType}) joined room ${roomName}`,
    );

    if (clientType === 'kiosk') {
      this.gateKioskSockets.set(gateId, client.id);

      this.eventEmitter.emit(EVENTS.GATE_CONNECTED, {
        gateId,
        socketId: client.id,
        timestamp: new Date(),
      });

      this.logger.log(
        `Registered kiosk socket ${client.id} for gate ${gateId}`,
      );

      // If an active session exists for this gate,
      // associate it with the reconnected kiosk socket.
      const existingSession =
        await this.sessionService.getSessionByGate(gateId);

      if (
        existingSession &&
        existingSession.socketId !== client.id
      ) {
        await this.sessionService.updateSession(
          existingSession.sessionId,
          {
            socketId: client.id,
          },
        );

        this.logger.log(
          `[KioskGateway] Reconnected kiosk socket ${client.id} ` +
            `associated with active session ${existingSession.sessionId}`,
        );
      }
    }

    const activeApproach = this.configService.get<string>(
      'ACTIVE_APPROACH',
      'voice',
    );

    const statePayload = {
      gateId,
      status: 'JOINED_ROOM',
      activeApproach,
      timestamp: new Date().toISOString(),
    };

    // Respond immediately to the client
    client.emit('kiosk.state', statePayload);

    // Broadcast to the gate room
    this.server.to(roomName).emit(
      'kiosk.state',
      statePayload,
    );

    return {
      event: 'kiosk.joined',
      gateId,
    };
  }

  @OnEvent(EVENTS.CHECKIN_DISPLAY_UPDATED)
  handleCheckinDisplayUpdated(payload: {
    gateId: string;
    token: string | null;
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

  @OnEvent(EVENTS.GATE_CONNECTED)
  handleGateConnectedBroadcast(payload: {
    gateId: string;
    socketId: string;
    timestamp: Date;
  }) {
    this.server.emit('gate.connected', {
      gateId: payload.gateId,
      connectedAt: payload.timestamp.toISOString(),
    });
  }

  @OnEvent(EVENTS.GATE_DISCONNECTED)
  handleGateDisconnectedBroadcast(payload: {
    gateId: string;
    socketId: string;
    timestamp: Date;
  }) {
    this.server.emit('gate.disconnected', {
      gateId: payload.gateId,
    });
  }

  @SubscribeMessage('INPUT')
  async handleInput(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: KioskInputDto,
  ) {
    if (!payload?.sessionId) {
      this.logger.warn(
        `[KioskGateway] Rejecting INPUT: payload missing sessionId`,
      );
      return;
    }

    const session = await this.sessionService.getSession(
      payload.sessionId,
    );

    if (!session) {
      this.logger.warn(
        `[KioskGateway] Rejecting INPUT: session not found ${payload.sessionId}`,
      );
      return;
    }

    if (session.socketId !== client.id) {
      this.logger.warn(
        `[KioskGateway] Rejecting INPUT: socket ${client.id} ` +
          `does not own session ${payload.sessionId}`,
      );
      return;
    }

    this.eventEmitter.emit(
      EVENTS.KIOSK_INPUT,
      payload,
    );
  }

  sendOutput(payload: KioskOutputDto) {
    const roomName = `gate:${payload.gateId}`;

    this.logger.log(
      `[KioskGateway] OUTPUT -> ${roomName}, state=${payload.state}`,
    );

    this.server.to(roomName).emit(
      'OUTPUT',
      payload,
    );
  }
}