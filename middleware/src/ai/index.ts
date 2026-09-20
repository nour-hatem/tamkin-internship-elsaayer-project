/**
 * Public surface of the middleware AI layer.
 *
 * Exported ports, tokens, adapters, and configuration.
 */

export { AiModule } from './ai.module';
export { AiConfigService } from './config/ai-config.service';

// STT
export { ISttAdapter, STT_ADAPTER_TOKEN } from './stt/stt.port';
export { StubSttAdapter } from './stt/stub-stt.adapter';
export { ElevenLabsSttAdapter } from './stt/elevenlabs-stt.adapter';
export { SttProviderError, SttFailureReason } from './stt/stt-provider.error';

// TTS
export { ITtsAdapter, TTS_ADAPTER_TOKEN } from './tts/tts.port';
export { StubTtsAdapter } from './tts/stub-tts.adapter';
export { ElevenLabsTtsAdapter } from './tts/elevenlabs-tts.adapter';
export { TtsProviderError, TtsFailureReason } from './tts/tts-provider.error';

// NLU
export { INluAdapter, NLU_ADAPTER_TOKEN } from './nlu/nlu.port';
export { StubNluAdapter } from './nlu/stub-nlu.adapter';
export { NluRulesAdapter } from './nlu/nlu-rules.adapter';
export { ContactMethod, CONTACT_METHOD_OPTIONS } from './nlu/contact-method';

// LLM
export { ILlmAdapter, LLM_ADAPTER_TOKEN } from './llm/llm.port';
export { StubLlmAdapter } from './llm/stub-llm.adapter';
export { LlmNluAdapter } from './llm/llm-nlu.adapter';
