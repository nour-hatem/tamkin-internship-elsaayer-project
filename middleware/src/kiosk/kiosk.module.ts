import { Module } from '@nestjs/common';
import { KioskService } from './kiosk.service';
import { KioskGateway } from './kiosk.gateway';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';
import { CheckInModule } from '../checkin/checkin.module';
import { RedisModule } from '../common/redis/redis.module';
import {
  AiModule,
  ElevenLabsSttAdapter,
  ElevenLabsTtsAdapter,
  LlmNluAdapter,
  NluRulesAdapter,
  StubTtsAdapter,
  TTS_ADAPTER_TOKEN,
  STT_ADAPTER_TOKEN,
  NLU_ADAPTER_TOKEN,
} from 'src/ai';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypedEventEmitter } from '@common/typed-event-emitter.service';
import { StubGateAdapter } from 'src/gate/adapters/stub-gate.adapter';
import { GATE_ADAPTER_TOKEN } from 'src/gate/ports/gate.port';

@Module({
  imports: [CheckInModule, RedisModule, AiModule, ConfigModule],
  providers: [
    KioskService,
    KioskGateway,
    SessionRepository,
    SessionService,
    {
      provide: TTS_ADAPTER_TOKEN,
      useClass: ElevenLabsTtsAdapter,
    },
    {
      provide: STT_ADAPTER_TOKEN,
      useClass: ElevenLabsSttAdapter,
    },
    {
      provide: NLU_ADAPTER_TOKEN,
      useClass: LlmNluAdapter,
    },
    {
      provide: GATE_ADAPTER_TOKEN,
      useClass: StubGateAdapter,
    },
    TypedEventEmitter,
  ],
  exports: [KioskService, SessionRepository, SessionService],
})
export class KioskModule {}
