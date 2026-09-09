import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
} from '@nestjs/common';

import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { CheckInService } from '../checkin/checkin.service';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { RedisService } from '../common/redis/redis.service';
import { QrCheckinDto } from './dto/qr-checkin.dto';
import { QrTicketRepository } from './repositories/qr-ticket.repository';
import { QrTokenService } from './qr-token.service';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly checkInService: CheckInService,
    private readonly redisService: RedisService,
    private readonly qrTicketRepository: QrTicketRepository,
    private readonly qrTokenService: QrTokenService,
  ) {}

  async createTicket() {
  const token = this.qrTokenService.generate();

  await this.qrTicketRepository.create(token, {
    gateId: 'gate-1',
    plateLocked: false,
    source: 'GENERIC',
  });

  const appUrl = this.configService.get<string>(
    'APP_URL',
    'http://localhost:3000',
  );

  return {
    token,
    checkInUrl: `${appUrl}/checkin?t=${token}`,
    expiresIn: 180,
  };
}

  async checkIn(dto: QrCheckinDto) {
  const ticket = await this.qrTicketRepository.consume(dto.token);

  if (!ticket) {
    throw new GoneException(
      'QR ticket is expired or has already been used',
    );
  }

  if (ticket.plateLocked && ticket.plate !== dto.plate) {
    throw new BadRequestException(
      'Plate number does not match the QR ticket',
    );
  }

  return this.checkInService.submit({
    gateId: ticket.gateId,
    plate: ticket.plateLocked && ticket.plate ? ticket.plate : dto.plate,
    name: dto.name,
    phone: dto.phone,
    source: 'QR',
  });
}

  async getTicketStatus(ticketId: string) {
    return {
      ticketId,
      status: 'ACTIVE',
      message: 'QR Ticket status placeholder',
    };
  }

  @OnEvent(EVENTS.SAP_LOOKUP_RESULT)
  async handleSapLookupResult(payload: SapLookupResultDto) {
    const activeApproach = this.configService.get<string>(
      'ACTIVE_APPROACH',
      'voice',
    );

    if (activeApproach.toLowerCase() !== 'qr') {
      this.logger.debug(
        `[QrService] Ignoring SAP result for ${payload.plate} - active approach is '${activeApproach}'`,
      );
      return;
    }

    this.logger.log(
      `[QrService] Processing active QR check-in for plate: ${payload.plate}`,
    );

    await this.checkInService.submit({
      gateId: 'gate-1',
      plate: payload.plate,
      name: payload.profile?.name || 'QR Customer',
      phone: payload.profile?.phone || '+966500000000',
      source: 'QR',
    });
  }
}
