import { configFor } from '../common/test-utils';

describe('AiConfigService (middleware)', () => {
  describe('defaults', () => {
    const config = configFor({});

    it('defaults adapter selections to offline stubs/rules', () => {
      expect(config.sttAdapter).toBe('stub');
      expect(config.ttsAdapter).toBe('stub');
      expect(config.nluAdapter).toBe('rules');
      expect(config.llmFallbackEnabled).toBe(false);
    });

    it('defaults models and voice', () => {
      expect(config.sttModel).toBe('scribe_v2');
      expect(config.ttsModel).toBe('eleven_v3');
      expect(config.ttsVoiceId).toBe('21m00Tcm4TlvDq8ikWAM');
      expect(config.ttsOutputFormat).toBe('mp3_44100_128');
    });

    it('defaults language to ar', () => {
      expect(config.language).toBe('ar');
    });

    it('defaults timeouts', () => {
      expect(config.sttTimeoutMs).toBe(5000);
      expect(config.ttsTimeoutMs).toBe(5000);
      expect(config.llmTimeoutMs).toBe(1500);
    });
  });

  describe('overrides with exact env names', () => {
    const config = configFor({
      STT_ADAPTER: 'elevenlabs',
      TTS_ADAPTER: 'elevenlabs',
      NLU_ADAPTER: 'llm',
      ELEVENLABS_STT_MODEL_ID: 'scribe_v2_custom',
      ELEVENLABS_TTS_MODEL_ID: 'eleven_multilingual_v2',
      ELEVENLABS_TTS_VOICE_ID: 'custom-voice',
      ELEVENLABS_TTS_OUTPUT_FORMAT: 'mp3_22050_32',
      ELEVENLABS_LANGUAGE: 'en',
      STT_TIMEOUT_MS: '2000',
      TTS_TIMEOUT_MS: '3000',
      LLM_TIMEOUT_MS: '1200',
    });

    it('reads overrides accurately', () => {
      expect(config.sttAdapter).toBe('elevenlabs');
      expect(config.ttsAdapter).toBe('elevenlabs');
      expect(config.nluAdapter).toBe('llm');
      expect(config.llmFallbackEnabled).toBe(true);
      expect(config.sttModel).toBe('scribe_v2_custom');
      expect(config.ttsModel).toBe('eleven_multilingual_v2');
      expect(config.ttsVoiceId).toBe('custom-voice');
      expect(config.ttsOutputFormat).toBe('mp3_22050_32');
      expect(config.language).toBe('en');
      expect(config.sttTimeoutMs).toBe(2000);
      expect(config.ttsTimeoutMs).toBe(3000);
      expect(config.llmTimeoutMs).toBe(1200);
    });
  });

  describe('describe()', () => {
    it('never leaks API keys', () => {
      const config = configFor({
        ELEVENLABS_API_KEY: 'secret-123',
        OPENROUTER_API_KEY: 'secret-456',
      });
      const desc = config.describe();
      expect(desc.elevenLabsApiKey).toBe('set');
      expect(desc.openRouterApiKey).toBe('set');
      expect(desc.groqApiKey).toBe('missing');
      expect(JSON.stringify(desc)).not.toContain('secret-123');
      expect(JSON.stringify(desc)).not.toContain('secret-456');
    });
  });
});
