import { Module } from '@nestjs/common';

import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutAdapter } from './adapters/checkout.adapter';
import { CHECKOUT_ADAPTER_TOKEN } from './ports/checkout.port';

import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [QueueModule],

  controllers: [CheckoutController],

  providers: [
    CheckoutService,
    {
      provide: CHECKOUT_ADAPTER_TOKEN,
      useClass: CheckoutAdapter,
    },
  ],

  exports: [CheckoutService],
})
export class CheckoutModule {}