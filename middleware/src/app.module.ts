import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { LprModule } from './lpr/lpr.module';
import { SapModule } from './sap/sap.module';
import { GateModule } from './gate/gate.module';
import { QueueModule } from './queue/queue.module';
import { CheckInModule } from './checkin/checkin.module';
import { QrModule } from './qr/qr.module';
import { KioskModule } from './kiosk/kiosk.module';
import { AiModule } from './ai/ai.module';
import { LoggerModule } from './common/logger/logger.module';
import { AdminModule } from './admin/admin.module';
import { InServiceModule } from './inService/inService.module';
import { CheckoutModule } from './checkout/checkout.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.resolve(process.cwd(), '.env.local'),
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../.env.local'),
        path.resolve(process.cwd(), '../.env'),
        path.resolve(__dirname, '../../.env.local'),
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../../../.env.local'),
        path.resolve(__dirname, '../../../.env'),
      ],
    }),
    CommonModule,
    HealthModule,
    LprModule,
    SapModule,
    GateModule,
    QueueModule,
    CheckInModule,
    QrModule,
    KioskModule,
    AiModule,
    LoggerModule,
    AdminModule,
    InServiceModule,
    CheckoutModule
  ],
})
export class AppModule {}
