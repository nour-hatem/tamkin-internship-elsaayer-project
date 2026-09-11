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
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { CheckInResultDto } from '../common/dtos/checkin-result.dto';
import { KioskStateEnum } from './enum/VoiceStateEnum';
import { KioskService } from './kiosk.service';
import { KioskOutputDto} from './interfaces/KioskOutputDto';
import { KioskInputDto } from './interfaces/KioskInputDto';


type SendGreetingDTO={
  sessionId:string,
  state:KioskStateEnum,
  message:string,
  audio:Buffer,
  gateId:string
}
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class KioskGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(KioskGateway.name);

  constructor(private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

    // Leave any other gate rooms the client is currently in
    for (const room of client.rooms) {
      if (room.startsWith('gate:') && room !== roomName) {
        client.leave(room);
        this.logger.log(`Client ${client.id} left previous room ${room}`);
      }
    }

    client.join(roomName);
    this.logger.log(`Client ${client.id} joined room ${roomName}`);
    this.logger.log(`Client ${client.id} active rooms: ${JSON.stringify(Array.from(client.rooms))}`);

    const activeApproach = this.configService.get<string>('ACTIVE_APPROACH', 'voice');

    const statePayload = {
      gateId,
      status: 'JOINED_ROOM',
      activeApproach,
      timestamp: new Date().toISOString(),
    };

    // Respond immediately to the client and broadcast to the room (so the Console knows)
    client.emit('kiosk.state', statePayload);
    this.server.to(roomName).emit('kiosk.state', statePayload);

    return { event: 'kiosk.joined', gateId };
  }

  // @OnEvent(EVENTS.SAP_LOOKUP_RESULT)
  // handleSapLookup(payload: SapLookupResultDto) {
  //   this.logger.log(`Broadcasting SAP result to gate rooms for plate: ${payload.plate}`);
  //   // Broadcast to all connected gate rooms
  //   this.server.emit('sap.result', payload);
  // }

  @OnEvent(EVENTS.CHECKIN_COMPLETED)
  handleCheckInCompleted(payload: CheckInResultDto) {
    this.logger.log(`Broadcasting Gate/Check-in state update: opened=${payload.gateOpened}`);
    this.server.emit('gate.state', payload);
  }

  @SubscribeMessage('INPUT')
handleInput(
  @MessageBody() payload: KioskInputDto,
) {
  this.eventEmitter.emit(EVENTS.KIOSK_INPUT, payload);
}

sendOutput(payload: KioskOutputDto) {
  const roomName = `gate:${payload.gateId}`;

  this.logger.log(
    `[KioskGateway] OUTPUT -> ${roomName}, state=${payload.state}`,
  );

  this.server.to(roomName).emit('OUTPUT', payload);
}


}
