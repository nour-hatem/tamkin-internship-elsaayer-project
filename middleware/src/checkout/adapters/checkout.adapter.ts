import { Injectable } from '@nestjs/common';
import { ICheckoutAdapter } from '../ports/checkout.port';
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class CheckoutAdapter implements ICheckoutAdapter {
  constructor(
    private readonly queueService: QueueService,
  ) {}

  async checkout(ticketId: string): Promise<void> {
    await this.queueService.updateTicketStatus(
      ticketId,
      'COMPLETED',
    );
  }
}