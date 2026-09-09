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

    it('defaults language to ar', () => {
      expect(config.language).toBe('ar');
    });

    it('defaults timeouts', () => {
      expect(config.sttTimeoutMs).toBe(5000);
      expect(config.ttsTimeoutMs).toBe(5000);
      expect(config.llmTimeoutMs).toBe(1500);
    });
  });

  describe('overrides', () => {
    const config = configFor({
      STT_ADAPTER: 'elevenlabs',
      TTS_ADAPTER: 'elevenlabs',
      NLU_ADAPTER: 'llm',
      ELEVENLABS_LANGUAGE: 'en',
      STT_TIMEOUT_MS: '2000',
    });

    it('reads overrides accurately', () => {
      expect(config.sttAdapter).toBe('elevenlabs');
      expect(config.ttsAdapter).toBe('elevenlabs');
      expect(config.nluAdapter).toBe('llm');
      expect(config.llmFallbackEnabled).toBe(true);
      expect(config.language).toBe('en');
      expect(config.sttTimeoutMs).toBe(2000);
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
