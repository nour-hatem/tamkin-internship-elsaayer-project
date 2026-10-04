import { Module } from '@nestjs/common';
import { InServiceService } from './inService.service';
import { InServiceAdapter } from './adapters/inService.adapter';
import {
  INSERVICE_ADAPTER_TOKEN,
} from './ports/inService.port';
import { QueueModule } from 'src/queue/queue.module';

@Module({
  imports: [QueueModule],
  providers: [
    InServiceService,
    {
      provide: INSERVICE_ADAPTER_TOKEN,
      useClass: InServiceAdapter,
    },
  ],
})
export class InServiceModule {}