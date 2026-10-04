import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import {
  CHECKOUT_ADAPTER_TOKEN,
  ICheckoutAdapter,
} from './ports/checkout.port';

import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly queueService: QueueService,

    @Inject(CHECKOUT_ADAPTER_TOKEN)
    private readonly checkoutAdapter: ICheckoutAdapter,
  ) {}

  async checkout(ticketId: string) {
    const ticket = await this.queueService.getTicketById(ticketId);

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    if (ticket.status !== 'IN_SERVICE') {
      throw new BadRequestException(
        `Ticket ${ticketId} is not IN_SERVICE`,
      );
    }

    this.logger.log(
      `[Checkout] Starting checkout for ticket ${ticketId}`,
    );

    await this.checkoutAdapter.checkout(ticketId);

    return {
      ticketId,
      status: 'COMPLETED',
    };
  }
}