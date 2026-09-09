import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { GateService } from '../gate/gate.service';
import { TypedEventEmitter } from '../common/typed-event-emitter.service';
import { EVENTS } from '../common/events';
import { CheckInRequestDto } from '../common/dtos/checkin-request.dto';
import { CheckInResultDto } from '../common/dtos/checkin-result.dto';

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly gateService: GateService,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

  async submit(request: CheckInRequestDto): Promise<CheckInResultDto> {
    this.logger.log(`Processing check-in request for plate: ${request.plate} via ${request.source}`);

    // 1. Duplicate check
    const existingTicket = await this.queueService.getActiveTicketForPlate(request.plate);
    if (existingTicket) {
      this.logger.warn(`Duplicate check-in blocked for plate ${request.plate}. Ticket ID: ${existingTicket.ticketId}`);
      const result: CheckInResultDto = {
        success: false,
        gateOpened: false,
        reason: `Customer with plate ${request.plate} is already checked in (Ticket: ${existingTicket.ticketId})`,
      };
      this.eventEmitter.emit(EVENTS.CHECKIN_COMPLETED, result);
      return result;
    }

    // 2. Queue enqueue
    const ticket = await this.queueService.enqueue(
      request.gateId,
      request.plate,
      request.name,
      request.phone,
      request.source,
    );

    // 3. Gate open decision
    const gateOpened = await this.gateService.openGate(request.gateId);

    const result: CheckInResultDto = {
      success: true,
      gateOpened,
      queueEntryId: ticket.ticketId,
      reason: gateOpened ? 'Check-in successful, gate opened.' : 'Check-in recorded, but gate failed to open.',
    };

    this.logger.log(`Check-in complete: Ticket ${ticket.ticketId}, Gate Opened: ${gateOpened}`);
    this.eventEmitter.emit(EVENTS.CHECKIN_COMPLETED, result);
    return result;
  }
}
