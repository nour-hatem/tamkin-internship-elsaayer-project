import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SapService } from './sap.service';
import { SAP_ADAPTER_TOKEN } from './ports/sap.port';
import { PrismaService } from './prisma.service';
import { SapAdapter } from './adapters/sap.adapter';


@Module({
  providers: [
    PrismaService,
    SapService,
    {
      provide: SAP_ADAPTER_TOKEN,
      useClass: SapAdapter
    },
  ],
  exports: [SapService, SAP_ADAPTER_TOKEN, PrismaService],
})
export class SapModule {}
