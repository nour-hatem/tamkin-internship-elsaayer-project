import { Controller, Param, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service';

@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkoutService: CheckoutService,
  ) {}

  @Post(':ticketId')
  async checkout(@Param('ticketId') ticketId: string) {
    return this.checkoutService.checkout(ticketId);
  }
}