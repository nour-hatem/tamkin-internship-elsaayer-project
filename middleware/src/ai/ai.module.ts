import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STT_ADAPTER_TOKEN } from './stt/stt.port';
import { StubSttAdapter } from './stt/stub-stt.adapter';

import { TTS_ADAPTER_TOKEN } from './tts/tts.port';
import { StubTtsAdapter } from './tts/stub-tts.adapter';

import { NLU_ADAPTER_TOKEN } from './nlu/nlu.port';
import { StubNluAdapter } from './nlu/stub-nlu.adapter';

import { LLM_ADAPTER_TOKEN } from './llm/llm.port';
import { StubLlmAdapter } from './llm/stub-llm.adapter';

@Module({
  providers: [
    {
      provide: STT_ADAPTER_TOKEN,
      useFactory: (config: ConfigService) => {
        return new StubSttAdapter();
      },
      inject: [ConfigService],
    },
    {
      provide: TTS_ADAPTER_TOKEN,
      useFactory: (config: ConfigService) => {
        return new StubTtsAdapter();
      },
      inject: [ConfigService],
    },
    {
      provide: NLU_ADAPTER_TOKEN,
      useFactory: (config: ConfigService) => {
        return new StubNluAdapter();
      },
      inject: [ConfigService],
    },
    {
      provide: LLM_ADAPTER_TOKEN,
      useFactory: (config: ConfigService) => {
        return new StubLlmAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    STT_ADAPTER_TOKEN,
    TTS_ADAPTER_TOKEN,
    NLU_ADAPTER_TOKEN,
    LLM_ADAPTER_TOKEN,
  ],
})
export class AiModule {}
