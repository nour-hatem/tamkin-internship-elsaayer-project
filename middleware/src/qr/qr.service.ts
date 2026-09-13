import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { CheckInService } from '../checkin/checkin.service';
import { EVENTS } from '../common/events';
import { SapLookupResultDto } from '../common/dtos/sap-lookup-result.dto';
import { QrCheckinDto } from './dto/qr-checkin.dto';
import {
  QrTicketData,
  QrTicketRepository,
} from './repositories/qr-ticket.repository';
import { QrTokenService } from './qr-token.service';
import { TypedEventEmitter } from '../common/typed-event-emitter.service';

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly checkInService: CheckInService,
    private readonly qrTicketRepository: QrTicketRepository,
    private readonly qrTokenService: QrTokenService,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  async createTicket(
    gateId = 'gate-1',
    data?: Partial<QrTicketData>,
  ) {
    const token = this.qrTokenService.generate();

    const ticketData: QrTicketData = {
      gateId,
      plateLocked: data?.plateLocked ?? false,
      source: data?.source ?? 'GENERIC',
      plate: data?.plate,
      name: data?.name,
      phone: data?.phone,
    };

    // Store the ticket itself with its TTL.
    await this.qrTicketRepository.create(token, ticketData);

    // Make this ticket the current ticket displayed for the gate.
    await this.qrTicketRepository.setCurrentTicket(gateId, token);

    // Keep the latest plate available while the ticket is active.
    if (data?.plate) {
      await this.qrTicketRepository.setPlateHint(
        gateId,
        data.plate,
      );
    }

    // Notify the kiosk console that the displayed QR has changed.
    this.logger.log(
      `[QrService] Emitting ${EVENTS.CHECKIN_DISPLAY_UPDATED} for gate ${gateId}`,
    );

    this.eventEmitter.emit(
      EVENTS.CHECKIN_DISPLAY_UPDATED,
      {
        gateId,
        token,
      },
    );

    this.logger.log(
      `[QrService] Event ${EVENTS.CHECKIN_DISPLAY_UPDATED} emitted`,
    );

    const expiresIn = 180;

    const expiresAt = new Date(
      Date.now() + expiresIn * 1000,
    ).toISOString();

    const appUrl =
      this.configService.getOrThrow<string>('APP_URL');

    const result = {
      token,
      gateId,
      checkInUrl: `${appUrl}/checkin?gate=${gateId}&t=${token}`,
      expiresIn,
      expiresAt,
      plate: ticketData.plate,
      plateLocked: ticketData.plateLocked,
      name: ticketData.name,
      phone: ticketData.phone,
      source: ticketData.source,
    };

    this.logger.log(
      `[QrService] Current ticket created for gate ${gateId}: ${token} (${ticketData.source})`,
    );

    return result;
  }

  async checkIn(dto: QrCheckinDto) {
    // Validate the plate and consume the ticket atomically.
    // A wrong plate must NOT burn the QR ticket.
    const consumeResult =
      await this.qrTicketRepository.consumeValidated(
        dto.token,
        dto.plate,
      );

    if (consumeResult.status === 'not_found') {
      throw new GoneException(
        'QR ticket is expired or has already been used',
      );
    }

    if (consumeResult.status === 'plate_mismatch') {
      throw new BadRequestException(
        'Plate number does not match the QR ticket',
      );
    }

    const ticket = consumeResult.ticket;

    const plate =
      ticket.plateLocked && ticket.plate
        ? ticket.plate
        : dto.plate;

    const result = await this.checkInService.submit({
      gateId: ticket.gateId,
      plate,
      name: dto.name,
      phone: dto.phone,
      source: 'QR',
    });

    if (!result.success) {
      throw new ConflictException(result);
    }

    // The QR has been successfully consumed.
    // Clear it from the gate's current display.
    await this.qrTicketRepository.clearCurrentTicket(
      ticket.gateId,
    );

    await this.qrTicketRepository.clearPlateHint(
      ticket.gateId,
    );

    // Notify the kiosk console that there is no active QR anymore.
    this.eventEmitter.emit(
      EVENTS.CHECKIN_DISPLAY_UPDATED,
      {
        gateId: ticket.gateId,
        token: null,
      },
    );

    return result;
  }

  async getTicketStatus(token: string) {
    const ticket = await this.qrTicketRepository.get(token);

    if (!ticket) {
      throw new GoneException(
        'QR ticket is expired or has already been used',
      );
    }

    return ticket;
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

    if (!payload.gateId) {
      this.logger.warn(
        `[QrService] Ignoring SAP result for ${payload.plate} because gateId is missing`,
      );
      return;
    }

    /*
     * CASE C
     * LPR + SAP HIT
     *
     * Plate is known and trusted from SAP.
     * Therefore the plate is locked on the mobile form.
     * Name and phone are prefilled from SAP.
     */
    if (payload.found && payload.profile) {
      const ticket = await this.createTicket(payload.gateId, {
        plate: payload.plate,
        plateLocked: true,
        name: payload.profile.name,
        phone: payload.profile.phone,
        source: 'SAP',
      });

      this.logger.log(
        `[QrService] CASE C - SAP HIT → QR ticket created for ${payload.plate}`,
      );

      return ticket;
    }

    /*
     * CASE B
     * LPR + SAP MISS
     *
     * We know the plate from LPR, but SAP does not know it.
     * Therefore:
     * - plate is prefilled
     * - plate remains editable
     * - name and phone are entered by the driver
     */
    const ticket = await this.createTicket(payload.gateId, {
      plate: payload.plate,
      plateLocked: false,
      source: 'LPR',
    });

    this.logger.log(
      `[QrService] CASE B - SAP MISS → QR ticket created for ${payload.plate}`,
    );

    return ticket;
  }

  async getCurrentTicket(gateId: string): Promise<string | null> {
    return this.qrTicketRepository.getCurrentTicket(gateId);
  }

  async getPlateHint(gateId: string): Promise<string | null> {
    return this.qrTicketRepository.getPlateHint(gateId);
  }

  getPublicCheckInUrl(gateId: string, token: string): string {
    const appUrl =
      this.configService.getOrThrow<string>('APP_URL');

    return `${appUrl}/checkin?gate=${gateId}&t=${token}`;
  }

  async getTicketExpiresAt(token: string): Promise<string | null> {
    const ticket = await this.qrTicketRepository.get(token);

    if (!ticket) {
      return null;
    }

    const ttl = await this.qrTicketRepository.getTtl(token);

    if (ttl <= 0) {
      return null;
    }

    return new Date(Date.now() + ttl * 1000).toISOString();
  }
}
