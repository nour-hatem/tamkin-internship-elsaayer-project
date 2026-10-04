import { Injectable } from "@nestjs/common";
import { IInServiceAdapter } from "../ports/inService.port";
import { QueueService } from "src/queue/queue.service";

@Injectable()
export class InServiceAdapter implements IInServiceAdapter {
  constructor(private readonly queueService: QueueService) {}

  async startService(ticketId: string): Promise<void> {
    setTimeout(async () => {
      await this.queueService.updateTicketStatus(
        ticketId,
        'IN_SERVICE',
      );
    }, 15_000);
  }
}