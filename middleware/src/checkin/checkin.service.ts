import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { GateService } from '../gate/gate.service';
import { TypedEventEmitter } from '../common/typed-event-emitter.service';
import { EVENTS } from '../common/events';
import { CheckInRequestDto } from '../common/dtos/checkin-request.dto';
import { CheckInResultDto } from '../common/dtos/checkin-result.dto';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);
  private readonly gateOpenRateLimitSeconds = 30;

  constructor(
    private readonly queueService: QueueService,
    private readonly gateService: GateService,
    private readonly eventEmitter: TypedEventEmitter,
    private readonly redisService: RedisService,
  ) {}

  async submit(request: CheckInRequestDto): Promise<CheckInResultDto> {
    this.logger.log(
      `[CheckIn] Check-in submitted: plate ${request.plate}, source ${request.source}, contactMethod ${request.preferredContactMethod}, gateId ${request.gateId}`,
      {
        plate: request.plate,
        source: request.source,
        contactMethod: request.preferredContactMethod,
        gateId: request.gateId,
      },
    );

    // 1. Duplicate check
    const existingTicket = await this.queueService.getActiveTicketForPlate(request.plate);

    if (existingTicket) {
      this.logger.warn(
        `[CheckIn] Check-in rejected (already checked in): plate ${request.plate}, ticketId ${existingTicket.ticketId}`,
        {
          plate: request.plate,
          ticketId: existingTicket.ticketId,
        },
      );

      const result: CheckInResultDto = {
        success: false,
        gateOpened: false,
        queueEntryId: existingTicket.ticketId,
        phone:existingTicket.phone,
        reason: `Customer with plate ${request.plate} is already checked in (Ticket: ${existingTicket.ticketId})`,
      };

      this.eventEmitter.emit(EVENTS.CHECKIN_COMPLETED, result);

      return result;
    }

    const isToyotaCustomer =
      request.isToyotaCustomer??request.IsToyotaCustomer ?? false;

    // 2. Queue enqueue
    const ticket = await this.queueService.enqueue(
      request.gateId,
      request.plate,
      request.name,
      request.phone,
      request.source,
      request.preferredContactMethod,
      isToyotaCustomer,
    );

    // Notify listeners that the check-in was submitted.
    this.eventEmitter.emit(EVENTS.CHECKIN_SUBMITTED, {
      gateId: request.gateId,
      plate: request.plate,
      name: request.name,
      phone: request.phone,
      source: request.source,
      preferredContactMethod: request.preferredContactMethod,
      queueEntryId: ticket.ticketId,
      isToyotaCustomer,
      IsToyotaCustomer: isToyotaCustomer,
    });

    // 3. Gate-open rate limit
    const gateLockKey = `checkin:gate:open:${request.gateId}`;

    const lockAcquired = await this.redisService
      .getClient()
      .set(gateLockKey, '1', 'EX', this.gateOpenRateLimitSeconds, 'NX');

    let gateOpened = false;

    if (lockAcquired === 'OK') {
      gateOpened = await this.gateService.openGate(request.gateId);
    } else {
      this.logger.log(
        `Gate ${request.gateId} is rate-limited. Check-in ${ticket.ticketId} remains queued.`,
        {
          gateId: request.gateId,
          ticketId: ticket.ticketId,
          plate: request.plate,
        },
      );
    }

   const result: CheckInResultDto = {
  success: true,
  gateOpened,
  queueEntryId: ticket.ticketId,
  phone: request.phone,
  reason: gateOpened
    ? 'Check-in successful, gate opened.'
    : 'Check-in recorded and queued. Gate is currently rate-limited.',
};

    this.logger.log(
      `[CheckIn] Check-in completed: Ticket ${ticket.ticketId}, plate ${request.plate}, gateId ${request.gateId}, gateOpened ${gateOpened}`,
      {
        ticketId: ticket.ticketId,
        plate: request.plate,
        gateId: request.gateId,
        gateOpened,
      },
    );

    this.eventEmitter.emit(EVENTS.CHECKIN_COMPLETED, result);

    return result;
  }
}
