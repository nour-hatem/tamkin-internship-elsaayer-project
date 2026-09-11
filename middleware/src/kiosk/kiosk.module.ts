import { Module } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import { KioskGateway } from './kiosk.gateway';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';
import { CheckInModule } from '../checkin/checkin.module';
import { RedisModule } from '../common/redis/redis.module';
import { AiModule, ElevenLabsTtsAdapter, StubTtsAdapter } from 'src/ai';

@Module({
  imports: [CheckInModule, RedisModule,AiModule],
  providers: [KioskService, KioskGateway, SessionRepository, SessionService,{
      provide: 'ITtsAdapter', 
      //useClass: ElevenLabsTtsAdapter,
      useClass:StubTtsAdapter
    },],
  exports: [KioskService, SessionRepository, SessionService],
})
export class KioskModule {}
