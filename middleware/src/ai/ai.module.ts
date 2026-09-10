import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { STT_ADAPTER_TOKEN } from './stt/stt.port';
import { StubSttAdapter } from './stt/stub-stt.adapter';
import { ElevenLabsSttAdapter } from './stt/elevenlabs-stt.adapter';

import { TTS_ADAPTER_TOKEN } from './tts/tts.port';
import { StubTtsAdapter } from './tts/stub-tts.adapter';
import { ElevenLabsTtsAdapter } from './tts/elevenlabs-tts.adapter';

import { NLU_ADAPTER_TOKEN } from './nlu/nlu.port';
import { StubNluAdapter } from './nlu/stub-nlu.adapter';
import { NluRulesAdapter } from './nlu/nlu-rules.adapter';

import { LLM_ADAPTER_TOKEN } from './llm/llm.port';
import { StubLlmAdapter } from './llm/stub-llm.adapter';
import { LlmNluAdapter } from './llm/llm-nlu.adapter';

import { AiConfigService } from './config/ai-config.service';

@Module({
  providers: [
    AiConfigService,
    // Real implementations registered alongside stubs (DECISIONS.md DR-008)
    ElevenLabsSttAdapter,
    ElevenLabsTtsAdapter,
    NluRulesAdapter,
    LlmNluAdapter,
    StubSttAdapter,
    StubTtsAdapter,
    StubNluAdapter,
    StubLlmAdapter,

    // Token bindings preserve existing stub defaults (DECISIONS.md DR-008)
    {
      provide: STT_ADAPTER_TOKEN,
      useFactory: (config: ConfigService, stub: StubSttAdapter, real: ElevenLabsSttAdapter) => {
        const mode = config.get<string>('STT_ADAPTER');
        return mode === 'elevenlabs' ? real : stub;
      },
      inject: [ConfigService, StubSttAdapter, ElevenLabsSttAdapter],
    },
    {
      provide: TTS_ADAPTER_TOKEN,
      useFactory: (config: ConfigService, stub: StubTtsAdapter, real: ElevenLabsTtsAdapter) => {
        const mode = config.get<string>('TTS_ADAPTER');
        return mode === 'elevenlabs' ? real : stub;
      },
      inject: [ConfigService, StubTtsAdapter, ElevenLabsTtsAdapter],
    },
    {
      provide: NLU_ADAPTER_TOKEN,
      useFactory: (
        config: ConfigService,
        stub: StubNluAdapter,
        rules: NluRulesAdapter,
        llm: LlmNluAdapter,
      ) => {
        const mode = config.get<string>('NLU_ADAPTER');
        if (mode === 'rules') return rules;
        if (mode === 'llm') return llm;
        return stub;
      },
      inject: [ConfigService, StubNluAdapter, NluRulesAdapter, LlmNluAdapter],
    },
    {
      provide: LLM_ADAPTER_TOKEN,
      useFactory: (_config: ConfigService) => {
        return new StubLlmAdapter();
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    AiConfigService,
    STT_ADAPTER_TOKEN,
    TTS_ADAPTER_TOKEN,
    NLU_ADAPTER_TOKEN,
    LLM_ADAPTER_TOKEN,
    ElevenLabsSttAdapter,
    ElevenLabsTtsAdapter,
    NluRulesAdapter,
    LlmNluAdapter,
    StubSttAdapter,
    StubTtsAdapter,
    StubNluAdapter,
    StubLlmAdapter,
  ],
})
export class AiModule {}
