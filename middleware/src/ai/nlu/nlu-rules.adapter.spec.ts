import { NluRulesAdapter } from './nlu-rules.adapter';
import { NluResultDto } from '../../common/dtos/nlu-result.dto';
import { installNetworkTripwire } from '../common/test-utils';

/**
 * NluRulesAdapter — migrated from src/ai/nlu/nlu-rules.service.spec.ts.
 *
 * Implements INluAdapter.parse(text: string): Promise<NluResultDto>
 * Returns NluResultDto with { intent, confidence, entities }.
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

  describe('affirmatives -> YES', () => {
    it.each(['yes', 'yeah', 'yep'])('English: %s', async (text) => {
      const res = await adapter.parse(text);
      expect(res).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });

    it.each(['أيوه', 'ايوه', 'نعم', 'تمام'])('Egyptian Arabic: %s', async (text) => {
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

    it('finds affirmative inside longer polite utterance', async () => {
      expect(await adapter.parse('yes that is correct')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
      expect(await adapter.parse('ايوه يا فندم')).toEqual({ intent: 'YES', confidence: 0.98, entities: {} });
    });
  });

  describe('negatives -> NO', () => {
    it.each(['no', 'nope'])('English: %s', async (text) => {
      const res = await adapter.parse(text);
      expect(res).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
    });

    it.each(['لا', 'لأ'])('Arabic: %s', async (text) => {
      const res = await adapter.parse(text);
      expect(res).toEqual({ intent: 'NO', confidence: 0.98, entities: {} });
    });

    it('matches whole tokens only, so "know" is not "no"', async () => {
      expect(await adapter.parse('I do not know')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
      expect(await adapter.parse('nothing')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });

    it('does not read "yes" out of "yesterday"', async () => {
      expect(await adapter.parse('yesterday')).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

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
  });

  describe('empty and unrelated input -> UNKNOWN', () => {
    it.each([
      ['empty string', ''],
      ['whitespace only', '   \n\t  '],
      ['unrelated English', 'where is the parking garage'],
      ['unrelated Arabic', 'فين مكان الانتظار'],
      ['punctuation only', '!!! ??? ...'],
    ])('%s', async (_label, text) => {
      expect(await adapter.parse(text)).toEqual({ intent: 'UNKNOWN', confidence: 0.0, entities: {} });
    });
  });

  describe('contract guarantees', () => {
    const corpus = ['yes', 'no', 'ايوه', 'لا', '01012345678', '', 'random words'];

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
