import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Which STT implementation AiModule should bind to STT_ADAPTER_TOKEN. */
export type SttAdapterChoice = 'stub' | 'elevenlabs';
/** Which TTS implementation AiModule should bind to TTS_ADAPTER_TOKEN. */
export type TtsAdapterChoice = 'stub' | 'elevenlabs';
/**
 * `rules`  → a rules UNKNOWN is returned as-is, no LLM call.
 * `llm`    → a rules UNKNOWN falls through to the OpenRouter/Groq cascade.
 */
export type NluAdapterChoice = 'rules' | 'llm';

const DEFAULTS = {
  elevenLabsBaseUrl: 'https://api.elevenlabs.io',
  sttModel: 'scribe_v2',
  ttsModel: 'eleven_v3',
  // ElevenLabs' long-standing public sample voice ("Rachel"). Not a secret.
  ttsVoiceId: '21m00Tcm4TlvDq8ikWAM',
  language: 'ar',
  sttTimeoutMs: 5_000,
  ttsTimeoutMs: 5_000,
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  groqBaseUrl: 'https://api.groq.com/openai/v1',
  llmModel: 'openai/gpt-oss-20b',
  llmTimeoutMs: 1_500,
} as const;

/**
 * Every environment read in the AI layer funnels through here.
 *
 * Migrated from src/ai/config/ai-config.service.ts and adapted to middleware's
 * real NestJS app context. See DECISIONS.md DR-008.
 */
@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(private readonly config: ConfigService) {}

  // ---- provider selection --------------------------------------------------

  get sttAdapter(): SttAdapterChoice {
    return this.enum<SttAdapterChoice>('STT_ADAPTER', ['stub', 'elevenlabs'], 'stub');
  }

  get ttsAdapter(): TtsAdapterChoice {
    return this.enum<TtsAdapterChoice>('TTS_ADAPTER', ['stub', 'elevenlabs'], 'stub');
  }

  /** Master switch for the LLM fallback. Defaults to `rules` — safe offline default. */
  get nluAdapter(): NluAdapterChoice {
    return this.enum<NluAdapterChoice>('NLU_ADAPTER', ['rules', 'llm'], 'rules');
  }

  get llmFallbackEnabled(): boolean {
    return this.nluAdapter === 'llm';
  }

  // ---- ElevenLabs ----------------------------------------------------------

  get elevenLabsApiKey(): string | undefined {
    return this.str('ELEVENLABS_API_KEY');
  }

  get elevenLabsBaseUrl(): string {
    return (this.str('ELEVENLABS_BASE_URL') ?? DEFAULTS.elevenLabsBaseUrl).replace(/\/+$/, '');
  }

  get sttModel(): string {
    return this.str('ELEVENLABS_STT_MODEL') ?? DEFAULTS.sttModel;
  }

  get ttsModel(): string {
    return this.str('ELEVENLABS_TTS_MODEL') ?? DEFAULTS.ttsModel;
  }

  get ttsVoiceId(): string {
    return this.str('ELEVENLABS_VOICE_ID') ?? DEFAULTS.ttsVoiceId;
  }

  /**
   * Default language for STT and TTS. The real ISttAdapter/ITtsAdapter ports
   * have no language parameter (see DECISIONS.md DR-003, DR-004), so adapters
   * read it from config rather than from the call site.
   */
  get language(): string {
    return this.str('ELEVENLABS_LANGUAGE') ?? DEFAULTS.language;
  }

  get sttTimeoutMs(): number {
    return this.int('STT_TIMEOUT_MS', DEFAULTS.sttTimeoutMs);
  }

  get ttsTimeoutMs(): number {
    return this.int('TTS_TIMEOUT_MS', DEFAULTS.ttsTimeoutMs);
  }

  // ---- LLM fallback --------------------------------------------------------

  get openRouterApiKey(): string | undefined {
    return this.str('OPENROUTER_API_KEY');
  }

  get openRouterBaseUrl(): string {
    return (this.str('OPENROUTER_BASE_URL') ?? DEFAULTS.openRouterBaseUrl).replace(/\/+$/, '');
  }

  get openRouterModel(): string {
    return this.str('OPENROUTER_MODEL') ?? DEFAULTS.llmModel;
  }

  get groqApiKey(): string | undefined {
    return this.str('GROQ_API_KEY');
  }

  get groqBaseUrl(): string {
    return (this.str('GROQ_BASE_URL') ?? DEFAULTS.groqBaseUrl).replace(/\/+$/, '');
  }

  get groqModel(): string {
    return this.str('GROQ_MODEL') ?? DEFAULTS.llmModel;
  }

  get llmTimeoutMs(): number {
    return this.int('LLM_TIMEOUT_MS', DEFAULTS.llmTimeoutMs);
  }

  // ---- diagnostics ---------------------------------------------------------

  describe(): Record<string, string | number | boolean> {
    return {
      sttAdapter: this.sttAdapter,
      ttsAdapter: this.ttsAdapter,
      nluAdapter: this.nluAdapter,
      sttModel: this.sttModel,
      ttsModel: this.ttsModel,
      language: this.language,
      openRouterModel: this.openRouterModel,
      groqModel: this.groqModel,
      sttTimeoutMs: this.sttTimeoutMs,
      ttsTimeoutMs: this.ttsTimeoutMs,
      llmTimeoutMs: this.llmTimeoutMs,
      elevenLabsApiKey: present(this.elevenLabsApiKey),
      openRouterApiKey: present(this.openRouterApiKey),
      groqApiKey: present(this.groqApiKey),
    };
  }

  // ---- primitives ----------------------------------------------------------

  private str(key: string): string | undefined {
    const raw = this.config.get<string>(key);
    if (raw === undefined || raw === null) return undefined;
    const trimmed = String(raw).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private int(key: string, fallback: number): number {
    const raw = this.str(key);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      this.logger.warn(`${key}="${raw}" is not a positive number; falling back to ${fallback}ms`);
      return fallback;
    }
    return Math.floor(parsed);
  }

  private enum<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
    const raw = this.str(key)?.toLowerCase();
    if (raw === undefined) return fallback;
    if ((allowed as readonly string[]).includes(raw)) return raw as T;
    this.logger.warn(`${key}="${raw}" is not one of ${allowed.join(' | ')}; falling back to "${fallback}"`);
    return fallback;
  }
}

const present = (v: string | undefined): string => (v ? 'set' : 'missing');
