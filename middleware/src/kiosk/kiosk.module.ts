import { Module } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import { KioskGateway } from './kiosk.gateway';
import { CheckInModule } from '../checkin/checkin.module';

@Module({
  imports: [CheckInModule],
  providers: [KioskService, KioskGateway],
  exports: [KioskService],
})
export class KioskModule {}
