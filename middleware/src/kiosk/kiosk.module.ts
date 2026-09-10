import { Module } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import { KioskGateway } from './kiosk.gateway';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';
import { CheckInModule } from '../checkin/checkin.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [CheckInModule, RedisModule],
  providers: [KioskService, KioskGateway, SessionRepository, SessionService],
  exports: [KioskService, SessionRepository, SessionService],
})
export class KioskModule {}
