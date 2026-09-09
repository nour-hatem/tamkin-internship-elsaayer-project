import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LprController } from './lpr.controller';
import { LprService } from './lpr.service';
import { LPR_ADAPTER_TOKEN } from './ports/lpr.port';
import { LprAdapter } from './adapters/lpr.adapter';

@Module({
  controllers: [LprController],
  providers: [
    LprService,
    {
      provide: LPR_ADAPTER_TOKEN,
      useClass: LprAdapter,
    },
  ],
  exports: [LprService],
})
export class LprModule {}
