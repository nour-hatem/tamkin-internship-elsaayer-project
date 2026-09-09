import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
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
  ],
})
export class AppModule {}
