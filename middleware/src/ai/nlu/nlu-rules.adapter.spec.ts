import { NluRulesAdapter } from './nlu-rules.adapter';
import { NluResultDto } from '../../common/dtos/nlu-result.dto';
import { installNetworkTripwire } from '../common/test-utils';

/**
 * NluRulesAdapter — spec covering Part A fixes:
 *   Bug 1: semantic full-utterance intent detection (restored token loop, ambiguity routing)
 *   Bug 2: phone extraction from corrected / word-form messy speech
 */
describe('NluRulesAdapter (Phase 2: deterministic rules -> NluResultDto)', () => {
  installNetworkTripwire();

  let adapter: NluRulesAdapter;

  beforeEach(() => {
    adapter = new NluRulesAdapter();
  });

  function expectValidDto(result: NluResultDto): void {
    expect(result).toHaveProperty('intent');
    expect(typeof result.intent).toBe('string');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.confidence).toBe('number');
    expect(result).toHaveProperty('entities');
    expect(typeof result.entities).toBe('object');
  }

  // ─── YES/NO — affirmatives ────────────────────────────────────────────────

  describe('affirmatives -> YES', () => {
    it.each(['yes', 'yeah', 'yep'])('bare English: %s', async (text) => {
      const res = await adapter.parse(text);
      expect(res).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });

    it.each(['أيوه', 'ايوه', 'نعم', 'تمام'])('bare Egyptian Arabic: %s', async (text) => {
      const res = await adapter.parse(text);
      expect(res).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });

    it('normalises case, padding, and inner whitespace', async () => {
      expect(await adapter.parse('   YES   ')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
      expect(await adapter.parse('Yeah')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
      expect(await adapter.parse('yes\n\tplease')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });

    it('folds Arabic hamza variants so أيوه and ايوه agree', async () => {
      expect(await adapter.parse('أيوه')).toEqual(await adapter.parse('ايوه'));
    });

    it('strips Arabic diacritics before matching', async () => {
      expect(await adapter.parse('نَعَم')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });

    // ── Full-sentence affirmations (Arabic and English) ──────────────────────
    it('full English sentence affirming -> YES', async () => {
      expect(await adapter.parse('yes that is correct')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
      expect(await adapter.parse('yes please go ahead')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });

    it('full Arabic sentence affirming -> YES', async () => {
      expect(await adapter.parse('ايوه يا فندم')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
      expect(await adapter.parse('ايوه يا فندم اللي انت قلته صح')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
      expect(await adapter.parse('تمام خلاص')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });
  });

  // ─── Sentences containing "yes" that are NOT affirmations ─────────────────

  describe('sentences containing "yes" that are NOT affirmations -> UNKNOWN (routes to LLM)', () => {
    it.each([
      ['question with yes', 'did you say yes'],
      ['reported speech with yes', 'he said yes'],
      ['doubtful yes', 'maybe yes'],
      ['conditional yes', 'لو ايوه'],
      ['possible yes', 'ممكن ايوه'],
      ['negated yes English', 'not yes'],
      ['negated yes Arabic', 'مش ايوه'],
      ['disjunctive yes or no', 'yes or no'],
      ['embedded substring', 'yesterday'],
    ])('%s: %s', async (_label, text) => {
      expect(await adapter.parse(text)).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  // ─── YES/NO — negatives ───────────────────────────────────────────────────

  describe('negatives -> NO', () => {
    it.each(['no', 'nope'])('bare English: %s', async (text) => {
      const res = await adapter.parse(text);
      expect(res).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
    });

    it.each(['لا', 'لأ'])('Arabic: %s', async (text) => {
      const res = await adapter.parse(text);
      expect(res).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
    });

    // ── Full-sentence negations ──────────────────────────────────────────────
    it('full English negation sentence -> NO', async () => {
      expect(await adapter.parse('no that is wrong')).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
      expect(await adapter.parse('nope try again')).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
    });

    it('full Arabic negation sentence -> NO', async () => {
      expect(await adapter.parse('لا مش صح')).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
      expect(await adapter.parse('لأ مش مظبوط')).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
    });

    it('matches whole tokens only — "know" is not "no"', async () => {
      expect(await adapter.parse('I do not know')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
      expect(await adapter.parse('nothing')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  // ─── YES/NO — ambiguous → UNKNOWN (routed to LLM) ────────────────────────

  describe('mixed / ambiguous utterances -> UNKNOWN (routes to LLM)', () => {
    it('both yes and no present -> UNKNOWN', async () => {
      expect(await adapter.parse('yes no')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
      expect(await adapter.parse('نعم لا')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });

    it('contradictory Arabic phrase -> UNKNOWN', async () => {
      expect(await adapter.parse('مش عارف اقول ايوه ولا لا')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });

    it('unrecognised utterance -> UNKNOWN', async () => {
      expect(await adapter.parse('where is the parking garage')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
      expect(await adapter.parse('فين مكان الانتظار')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  // ─── Phone extraction ─────────────────────────────────────────────────────

  describe('phone extraction -> PHONE with entities.phone', () => {
    it('accepts a clean 11-digit 01 number', async () => {
      expect(await adapter.parse('01012345678')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01012345678' },
      });
    });

    it.each(['010', '011', '012', '015'])('accepts every Egyptian mobile prefix: %s', async (prefix) => {
      const number = `${prefix}12345678`;
      expect(await adapter.parse(number)).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: number },
      });
    });

    it('strips separators and symbols surrounding valid number', async () => {
      for (const spoken of [
        '010-1234-5678',
        '010 1234 5678',
        '(010) 1234 5678',
        'my number is 010 123 456 78 thanks',
        '٠١٠١٢٣٤٥٦٧٨',
      ]) {
        expect(await adapter.parse(spoken)).toEqual({
          intent: 'PHONE',
          confidence: 0.99,
          entities: { phone: '01012345678' },
        });
      }
    });

    it('converts Arabic-Indic digits', async () => {
      expect(await adapter.parse('رقمي ٠١١٢٢٢٣٣٣٤٥')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01122233345' },
      });
    });

    it('converts Extended Arabic-Indic (Persian) digits', async () => {
      expect(await adapter.parse('۰۱۰۱۲۳۴۵۶۷۸')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01012345678' },
      });
    });

    it('spoken Arabic digit words — clean sequence', async () => {
      expect(await adapter.parse('صفر واحد صفر واحد اثنين ثلاثة أربعة خمسة ستة سبعة ثمانية')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01012345678' },
      });
    });

    it('spoken English digit words — clean sequence', async () => {
      expect(await adapter.parse('zero one zero one two three four five six seven eight')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01012345678' },
      });
    });

    // ── Bug 2: Phone numbers spoken with corrections ─────────────────────────
    it('corrected speech with digit literals — last valid number wins', async () => {
      expect(await adapter.parse('01099999999 لا لا 01234567890')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01234567890' },
      });
    });

    it('corrected speech with Arabic word-form digits — last valid sequence wins', async () => {
      expect(await adapter.parse('صفر واحد صفر تسعة تسعة تسعة تسعة تسعة تسعة تسعة تسعة لأ لأ صفر واحد اثنين ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة صفر')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01234567890' },
      });
    });

    it('corrected speech mid-number prefix restart — extracts valid sequence', async () => {
      expect(await adapter.parse('صفر واحد صفر لأ لأ صفر واحد اثنين ثلاثة أربعة خمسة ستة سبعة ثمانية تسعة صفر')).toEqual({
        intent: 'PHONE',
        confidence: 0.99,
        entities: { phone: '01234567890' },
      });
    });

    it('REJECTS a 10-digit number', async () => {
      expect(await adapter.parse('0101234567')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });

    it('REJECTS a 12-digit number', async () => {
      expect(await adapter.parse('010123456789')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });

    it('REJECTS country code +20 (12 digits)', async () => {
      expect(await adapter.parse('+20 101 234 5678')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });

    it('REJECTS 11 digits not starting 01', async () => {
      expect(await adapter.parse('02012345678')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });

    // ── Completely garbled input ─────────────────────────────────────────────
    it('completely garbled input -> UNKNOWN', async () => {
      expect(await adapter.parse('ممممم هههه اااا')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
      expect(await adapter.parse('hmmm uh uh uh')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  // ─── Contact-method parsing ────────────────────────────────────────────────

  describe('contact-method parsing -> CONTACT_METHOD with entities.contactMethod', () => {
    function cm(contactMethod: string): NluResultDto {
      return { intent: 'CONTACT_METHOD', confidence: 0.97, entities: { contactMethod } };
    }

    // ── Via bare number ──────────────────────────────────────────────────────
    it('bare digit 1 -> SMS', async () => {
      expect(await adapter.parse('1')).toEqual(cm('SMS'));
    });
    it('bare digit 2 -> WHATSAPP', async () => {
      expect(await adapter.parse('2')).toEqual(cm('WHATSAPP'));
    });
    it('bare digit 3 -> ELSAAYER_APP', async () => {
      expect(await adapter.parse('3')).toEqual(cm('ELSAAYER_APP'));
    });
    it('bare digit 4 -> CALLING_AGENT', async () => {
      expect(await adapter.parse('4')).toEqual(cm('CALLING_AGENT'));
    });

    it('Arabic-Indic digit ٢ -> WHATSAPP', async () => {
      expect(await adapter.parse('٢')).toEqual(cm('WHATSAPP'));
    });

    // ── Via number with context ──────────────────────────────────────────────
    it('"رقم 2" -> WHATSAPP', async () => {
      expect(await adapter.parse('رقم 2')).toEqual(cm('WHATSAPP'));
    });
    it('"option 3" -> ELSAAYER_APP', async () => {
      expect(await adapter.parse('option 3')).toEqual(cm('ELSAAYER_APP'));
    });
    it('"اختار رقم 4" -> CALLING_AGENT', async () => {
      expect(await adapter.parse('اختار رقم 4')).toEqual(cm('CALLING_AGENT'));
    });
    it('"الرقم التاني" -> WHATSAPP', async () => {
      expect(await adapter.parse('الرقم التاني')).toEqual(cm('WHATSAPP'));
    });

    // ── Via ordinal ──────────────────────────────────────────────────────────
    it('"التانية" -> WHATSAPP', async () => {
      expect(await adapter.parse('التانية')).toEqual(cm('WHATSAPP'));
    });
    it('"تاني واحدة" -> WHATSAPP', async () => {
      expect(await adapter.parse('تاني واحدة')).toEqual(cm('WHATSAPP'));
    });
    it('"the second one" -> WHATSAPP', async () => {
      expect(await adapter.parse('the second one')).toEqual(cm('WHATSAPP'));
    });
    it('"التالتة" -> ELSAAYER_APP', async () => {
      expect(await adapter.parse('التالتة')).toEqual(cm('ELSAAYER_APP'));
    });
    it('"the third one" -> ELSAAYER_APP', async () => {
      expect(await adapter.parse('the third one')).toEqual(cm('ELSAAYER_APP'));
    });
    it('"الرابعة" -> CALLING_AGENT', async () => {
      expect(await adapter.parse('الرابعة')).toEqual(cm('CALLING_AGENT'));
    });
    it('"the fourth one" -> CALLING_AGENT', async () => {
      expect(await adapter.parse('the fourth one')).toEqual(cm('CALLING_AGENT'));
    });

    // ── Via method name ──────────────────────────────────────────────────────
    it('"SMS" -> SMS', async () => {
      expect(await adapter.parse('SMS')).toEqual(cm('SMS'));
    });
    it('"رسالة نصية" -> SMS', async () => {
      expect(await adapter.parse('رسالة نصية')).toEqual(cm('SMS'));
    });
    it('"واتساب" -> WHATSAPP', async () => {
      expect(await adapter.parse('واتساب')).toEqual(cm('WHATSAPP'));
    });
    it('"WhatsApp" -> WHATSAPP', async () => {
      expect(await adapter.parse('WhatsApp')).toEqual(cm('WHATSAPP'));
    });
    it('"مكالمة" -> CALLING_AGENT', async () => {
      expect(await adapter.parse('مكالمة')).toEqual(cm('CALLING_AGENT'));
    });
    it('"call me" -> CALLING_AGENT', async () => {
      expect(await adapter.parse('call me')).toEqual(cm('CALLING_AGENT'));
    });
    it('"التطبيق" -> ELSAAYER_APP', async () => {
      expect(await adapter.parse('التطبيق')).toEqual(cm('ELSAAYER_APP'));
    });

    // ── Out-of-range, ambiguous, and invalid inputs -> UNKNOWN ───────────────
    it('digit 0 -> UNKNOWN (out of range)', async () => {
      expect(await adapter.parse('0')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
    it('digit 5 -> UNKNOWN (out of range)', async () => {
      expect(await adapter.parse('5')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
    it('conflicting/ambiguous methods "واتساب او sms" -> UNKNOWN (routes to LLM)', async () => {
      expect(await adapter.parse('واتساب او sms')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
    it('unrelated input -> UNKNOWN', async () => {
      expect(await adapter.parse('أنا مش فاهم')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
    it('empty input -> UNKNOWN', async () => {
      expect(await adapter.parse('')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  // ─── Empty and unrelated input ────────────────────────────────────────────

  describe('empty and unrelated input -> UNKNOWN', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   \n\t  '],
      ['punctuation only', '!!! ??? ...'],
    ])('%s', async (_label, text) => {
      expect(await adapter.parse(text)).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  // ─── Contract guarantees ──────────────────────────────────────────────────

  describe('contract guarantees', () => {
    const corpus = ['yes', 'no', 'ايوه', 'لا', '01012345678', '', 'random words', '2', 'واتساب'];

    it('every input yields valid NluResultDto', async () => {
      for (const text of corpus) {
        expectValidDto(await adapter.parse(text));
      }
    });

    it('is deterministic', async () => {
      for (const text of corpus) {
        const first = await adapter.parse(text);
        for (let i = 0; i < 3; i++) {
          expect(await adapter.parse(text)).toEqual(first);
        }
      }
    });
  });
});
