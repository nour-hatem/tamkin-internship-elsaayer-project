import { Injectable, Logger } from '@nestjs/common';
import { NluResultDto } from '../../common/dtos/nlu-result.dto';
import { INluAdapter } from '../nlu/nlu.port';
import { AiConfigService } from '../config/ai-config.service';
import { NluRulesAdapter, extractPhone, normalize } from '../nlu/nlu-rules.adapter';
import { HttpTimeoutError, fetchWithTimeout, safeBodySnippet } from '../common/http';

/**
 * What this classifier is allowed to emit, stated to the model.
 * Both providers speak the OpenAI /chat/completions dialect.
 */
const SYSTEM_PROMPT = [
  'You classify ONE short spoken utterance from a driver at a vehicle gate kiosk in Egypt.',
  'The driver speaks Egyptian Arabic or English.',
  'Reply with ONLY a JSON object. No prose, no explanation, no markdown fences.',
  '',
  'Exactly one of these four shapes is allowed:',
  '{"intent":"YES"}     - agreement, confirmation, assent',
  '{"intent":"NO"}      - disagreement, refusal, denial',
  '{"intent":"PHONE","phone":"01XXXXXXXXX"} - an Egyptian mobile number: exactly 11 digits, starting 01',
  '{"intent":"UNKNOWN"} - anything else, or whenever you are not sure',
  '',
  'Rules:',
  '- Never invent or complete digits. Only emit PHONE when a full 11-digit number is actually spoken.',
  '- If the utterance is empty, unrelated, or ambiguous, answer {"intent":"UNKNOWN"}.',
  '- When in doubt, answer {"intent":"UNKNOWN"}. A wrong guess at a gate barrier is worse than asking again.',
].join('\n');

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
}

interface ProviderConfig {
  readonly name: 'openrouter' | 'groq';
  readonly baseUrl: string;
  readonly apiKey: string | undefined;
  readonly model: string;
}

/** Internal four-variant discriminated type used before mapping to NluResultDto. */
type ClassifyResult =
  | { intent: 'YES' }
  | { intent: 'NO' }
  | { intent: 'PHONE'; phone: string }
  | { intent: 'UNKNOWN' };

/**
 * LLM-backed transcript classifier, used strictly as a fallback behind the
 * deterministic rules.
 *
 * Implements INluAdapter — the REAL middleware port (see DECISIONS.md DR-005,
 * DR-006):
 *   parse(text: string): Promise<NluResultDto>
 *
 * Pipeline:
 *   transcript → NluRulesAdapter
 *     clear result → return it, no LLM call at all
 *     UNKNOWN → OpenRouter (~1.5s)
 *       success → NluResultDto
 *       fail/timeout → Groq (~1.5s)
 *         success → NluResultDto
 *         fail/timeout → { intent: 'UNKNOWN', confidence: 0, entities: {} }
 *
 * Two invariants:
 * 1. It never throws. Every path resolves to a valid NluResultDto.
 * 2. It decides nothing. Its only output is one of four intent values.
 *    It has no reference to gate control, check-in, or the queue.
 */
@Injectable()
export class LlmNluAdapter implements INluAdapter {
  private readonly logger = new Logger(LlmNluAdapter.name);

  constructor(
    private readonly rules: NluRulesAdapter,
    private readonly config: AiConfigService,
  ) {}

  async parse(text: string): Promise<NluResultDto> {
    // Rules first, always. A clear utterance must never cost an LLM call.
    const ruled = await this.rules.parse(text);
    if (ruled.intent !== 'UNKNOWN') return ruled;

    if (!this.config.llmFallbackEnabled) {
      return UNKNOWN_DTO;
    }

    const normalized = normalize(text ?? '');
    if (normalized.length === 0) return UNKNOWN_DTO;

    for (const provider of this.providers()) {
      const result = await this.tryProvider(provider, normalized);
      if (result !== undefined) return toDto(result);
    }

    this.logger.warn('Both LLM providers failed to classify a transcript; resolving to UNKNOWN');
    return UNKNOWN_DTO;
  }

  /** OpenRouter first, Groq second. Order is fixed, not load-balanced. */
  private providers(): ProviderConfig[] {
    return [
      {
        name: 'openrouter',
        baseUrl: this.config.openRouterBaseUrl,
        apiKey: this.config.openRouterApiKey,
        model: this.config.openRouterModel,
      },
      {
        name: 'groq',
        baseUrl: this.config.groqBaseUrl,
        apiKey: this.config.groqApiKey,
        model: this.config.groqModel,
      },
    ];
  }

  /**
   * @returns a validated ClassifyResult, or `undefined` to mean "try next provider".
   */
  private async tryProvider(
    provider: ProviderConfig,
    normalized: string,
  ): Promise<ClassifyResult | undefined> {
    if (!provider.apiKey) {
      this.logger.warn(`Skipping ${provider.name}: API key is not configured`);
      return undefined;
    }

    const timeoutMs = this.config.llmTimeoutMs;

    try {
      const response = await fetchWithTimeout(
        `${provider.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: provider.model,
            temperature: 0,
            max_tokens: 150,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: normalized },
            ],
          }),
        },
        timeoutMs,
      );

      if (!response.ok) {
        const body = await safeBodySnippet(response, 200);
        this.logger.warn(`${provider.name} returned HTTP ${response.status}: ${body}`);
        return undefined;
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        this.logger.warn(`${provider.name} response had no string message content`);
        return undefined;
      }

      const parsed = parseClassifyResult(content);
      if (parsed === undefined) {
        this.logger.warn(`${provider.name} returned unparseable content: ${truncate(content)}`);
        return undefined;
      }

      if (parsed.intent === 'PHONE' && extractPhone(normalized) !== parsed.phone) {
        this.logger.log(
          `${provider.name} derived a phone number not present verbatim in the transcript`,
        );
      }

      this.logger.log(
        `${provider.name} classified transcript as ${parsed.intent} (model=${provider.model})`,
      );
      return parsed;
    } catch (error) {
      if (error instanceof HttpTimeoutError) {
        this.logger.warn(`${provider.name} timed out after ${timeoutMs}ms; falling through`);
      } else {
        this.logger.warn(
          `${provider.name} request failed: ${errorMessage(error)}; falling through`,
        );
      }
      return undefined;
    }
  }
}

/**
 * Parse model output into a trusted ClassifyResult.
 *
 * Tolerates markdown fences and prose padding. Anything that does not survive
 * validation is discarded rather than coerced.
 */
export function parseClassifyResult(content: string): ClassifyResult | undefined {
  const candidates: string[] = [];

  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  candidates.push(content.trim());

  const braced = content.match(/\{[\s\S]*\}/);
  if (braced?.[0]) candidates.push(braced[0]);

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (isClassifyResult(parsed)) {
        // Rebuild into a canonical object; never hand back model-shaped data.
        switch (parsed.intent) {
          case 'YES':
            return { intent: 'YES' };
          case 'NO':
            return { intent: 'NO' };
          case 'PHONE':
            return { intent: 'PHONE', phone: parsed.phone };
          case 'UNKNOWN':
            return { intent: 'UNKNOWN' };
        }
      }
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
}

function isClassifyResult(value: unknown): value is ClassifyResult {
  if (typeof value !== 'object' || value === null) return false;
  const intent = (value as { intent?: unknown }).intent;
  switch (intent) {
    case 'YES':
    case 'NO':
    case 'UNKNOWN':
      return true;
    case 'PHONE': {
      const phone = (value as { phone?: unknown }).phone;
      return typeof phone === 'string' && /^01\d{9}$/.test(phone);
    }
    default:
      return false;
  }
}

function toDto(result: ClassifyResult): NluResultDto {
  switch (result.intent) {
    case 'YES':
      return { intent: 'YES', confidence: 0.98, entities: {} };
    case 'NO':
      return { intent: 'NO', confidence: 0.98, entities: {} };
    case 'PHONE':
      return { intent: 'PHONE', confidence: 0.99, entities: { phone: result.phone } };
    case 'UNKNOWN':
      return UNKNOWN_DTO;
  }
}

const UNKNOWN_DTO: NluResultDto = { intent: 'UNKNOWN', confidence: 0.0, entities: {} };

const truncate = (s: string, max = 120): string =>
  s.length > max ? `${s.slice(0, max)}…` : s;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
