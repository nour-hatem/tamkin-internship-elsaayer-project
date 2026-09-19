import { Injectable } from '@nestjs/common';
import { NluResultDto } from '../../common/dtos/nlu-result.dto';
import { INluAdapter } from './nlu.port';

/**
 * English affirmatives. Matched as whole tokens, never substrings.
 * "yesterday" is not a yes; "know" is not a no.
 */
const AFFIRMATIVE_EN = ['yes', 'yeah', 'yep'] as const;
/** Egyptian Arabic affirmatives, written post-normalisation (see `normalize`). */
const AFFIRMATIVE_AR = ['ايوه', 'نعم', 'تمام'] as const;
const NEGATIVE_EN = ['no', 'nope', 'not', 'wrong'] as const;
const NEGATIVE_AR = ['لا', 'له', 'مش', 'غلط'] as const;

/**
 * Words indicating doubt, condition, questions, or indirect speech.
 * When present in an utterance, intent cannot be unambiguously decided by rules alone.
 */
const AMBIGUOUS_EN = [
  'if', 'maybe', 'perhaps', 'doubt', 'know', 'sure', 'or', 'what',
  'why', 'how', 'who', 'where', 'when', 'which', 'did', 'would',
  'could', 'should', 'said', 'say',
] as const;
const AMBIGUOUS_AR = [
  'لو', 'يمكن', 'ممكن', 'شك', 'عارف', 'متاكد', 'ولا', 'او', 'ايه',
  'ليه', 'ازاي', 'مين', 'فين', 'امتى', 'هل', 'قال', 'بيقول', 'اقول',
] as const;

const AFFIRMATIVES: ReadonlySet<string> = new Set<string>([...AFFIRMATIVE_EN, ...AFFIRMATIVE_AR]);
const NEGATIVES: ReadonlySet<string> = new Set<string>([...NEGATIVE_EN, ...NEGATIVE_AR]);
const AMBIGUOUS: ReadonlySet<string> = new Set<string>([...AMBIGUOUS_EN, ...AMBIGUOUS_AR]);

/** A complete Egyptian mobile number: exactly 11 digits, leading `01`. */
const EGYPTIAN_MOBILE = /^01\d{9}$/;

/**
 * Arabic-Indic (٠-٩, U+0660) and Extended Arabic-Indic (۰-۹, U+06F0) digits
 * mapped to ASCII. ElevenLabs returns spoken Egyptian numerals in these forms.
 */
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g;
/** Tashkeel (diacritics) and tatweel (ـ elongation) carry no lexical meaning. */
const ARABIC_DIACRITICS = /[ً-ْٰـ]/g;
/** Alef and hamza variants → bare alef. */
const ALEF_VARIANTS = /[أإآٱ]/g;
/** Trailing ى → ي, ة → ه: common Egyptian orthographic drift. */
const YEH_VARIANTS = /ى/g;
const TEH_MARBUTA = /ة/g;

/**
 * Deterministic transcript classifier. No network, no AI, no state.
 *
 * Implements INluAdapter — the REAL middleware port (see DECISIONS.md DR-005):
 *   parse(text: string): Promise<NluResultDto>
 *
 * Produces NluResultDto with the canonical shape from middleware/src/common/dtos/.
 * The discriminated-union NluResult type from the overnight build is NOT used here;
 * mapping to NluResultDto is documented in DECISIONS.md DR-002.
 *
 * Classification order: phone first, then yes/no (see DR-002 / D-010).
 */
@Injectable()
export class NluRulesAdapter implements INluAdapter {
  async parse(text: string): Promise<NluResultDto> {
    return classify(text);
  }
}

/**
 * Exported so LlmNluAdapter can call the rules synchronously before deciding
 * whether to hit the LLM. The function is synchronous and has no side effects.
 */
export function classifySync(text: string): NluResultDto {
  return classify(text);
}

function classify(raw: string): NluResultDto {
  if (typeof raw !== 'string') return UNKNOWN_RESULT;

  const normalized = normalize(raw);
  if (normalized.length === 0) return UNKNOWN_RESULT;

  const phone = extractPhone(normalized);
  if (phone !== undefined) {
    return { intent: 'PHONE', confidence: 0.99, entities: { phone } };
  }

  return matchYesNo(normalized);
}

/**
 * Interprets the full utterance semantically by scanning every token.
 *
 * Rules:
 *  - Clear affirmation only (no negatives, no ambiguous tokens) → YES
 *  - Clear negation only (no affirmatives, no ambiguous tokens) → NO
 *  - Mixed, contradictory, question, doubt, or unrecognised → UNKNOWN (routes to LLM)
 */
function matchYesNo(normalized: string): NluResultDto {
  const tokens = tokenize(normalized);

  let sawAffirmative = false;
  let sawNegative = false;
  let sawAmbiguous = false;

  for (const token of tokens) {
    if (AFFIRMATIVES.has(token)) sawAffirmative = true;
    if (NEGATIVES.has(token)) sawNegative = true;
    if (AMBIGUOUS.has(token)) sawAmbiguous = true;
  }

  // Ambiguous, contradictory, or unrecognised → route to LLM fallback.
  if (sawAmbiguous || (sawAffirmative && sawNegative)) return UNKNOWN_RESULT;
  if (sawAffirmative) return { intent: 'YES', confidence: 0.98, entities: {} };
  if (sawNegative) return { intent: 'NO', confidence: 0.98, entities: {} };
  return UNKNOWN_RESULT;
}

/**
 * Trim, lowercase, fold Arabic digit and letter variants.
 * Exported for LlmNluAdapter, which normalises identically.
 */
export function normalize(raw: string): string {
  return raw
    .normalize('NFKC')
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.codePointAt(0)! & 0x0f))
    .replace(ARABIC_DIACRITICS, '')
    .replace(ALEF_VARIANTS, 'ا')
    .replace(YEH_VARIANTS, 'ي')
    .replace(TEH_MARBUTA, 'ه')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Split on anything that is not a letter or digit, in any script. */
function tokenize(normalized: string): string[] {
  return normalized.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 0);
}

/**
 * Strip every non-digit and accept the remainder only if it is exactly an
 * 11-digit 01… Egyptian mobile. Deliberately strict — a wrong number silently
 * accepted here becomes an SMS to a stranger.
 */
export function extractPhone(normalized: string): string | undefined {
  const digits = normalized.replace(/\D/g, '');
  return EGYPTIAN_MOBILE.test(digits) ? digits : undefined;
}

const UNKNOWN_RESULT: NluResultDto = { intent: 'UNKNOWN', confidence: 0.0, entities: {} };
