import { Injectable, Optional } from "@nestjs/common";
import { IInServiceAdapter } from "../ports/inService.port";
import { QueueService } from "src/queue/queue.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { EVENTS } from "@common/events";

@Injectable()
export class InServiceAdapter implements IInServiceAdapter {
  constructor(private readonly queueService: QueueService,
    @Optional()
        private readonly eventEmitter?: EventEmitter2,
  ) {}

  async startService(ticketId: string): Promise<void> {
    setTimeout(async () => {
     const ticket= await this.queueService.updateTicketStatus(
        ticketId,
        'IN_SERVICE',
      );
    }, 15_000);
  }
}