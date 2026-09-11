import { Module } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import { KioskGateway } from './kiosk.gateway';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';
import { CheckInModule } from '../checkin/checkin.module';
import { RedisModule } from '../common/redis/redis.module';
import { AiModule, ElevenLabsSttAdapter, ElevenLabsTtsAdapter, NluRulesAdapter, StubTtsAdapter } from 'src/ai';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypedEventEmitter } from '@common/typed-event-emitter.service';
import { StubGateAdapter } from 'src/gate/adapters/stub-gate.adapter';

@Module({
  imports: [CheckInModule, RedisModule,AiModule,ConfigModule],
  providers: [KioskService, KioskGateway, SessionRepository, SessionService,{
      provide: 'ITtsAdapter', 
      useClass: ElevenLabsTtsAdapter,
      //useClass:StubTtsAdapter
    },{
      provide: 'ISttAdapter', 
      useClass: ElevenLabsSttAdapter,
    },{
      provide:'INluAdapter',
      useClass:NluRulesAdapter
    },{
      provide:'IGateAdapter',
      useClass:StubGateAdapter
    },
    TypedEventEmitter
  ],
  exports: [KioskService, SessionRepository, SessionService],
})
export class KioskModule {}
