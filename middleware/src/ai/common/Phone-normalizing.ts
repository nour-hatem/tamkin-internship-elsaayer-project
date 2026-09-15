export function normalizeNumberWords(text: string): string {
  const numberMap: Record<string, string> = {
    صفر: '0',
    واحد: '1',
    اثنان: '2',
    اثنين: '2',
    إثنان: '2',
    إثنين: '2',
    ثلاثة: '3',
    ثلاث: '3',
    أربعة: '4',
    اربعة: '4',
    أربعه: '4',
    خمسة: '5',
    خمسه: '5',
    ستة: '6',
    سته: '6',
    سبعة: '7',
    سبعه: '7',
    ثمانية: '8',
    ثمانيه: '8',
    تسعة: '9',
    تسعه: '9',

    zero: '0',
    one: '1',
    two: '2',
    three: '3',
    four: '4',
    five: '5',
    six: '6',
    seven: '7',
    eight: '8',
    nine: '9',
  };

  const words = text.split(/\s+/);

  return words
    .map((word) => {
      const normalized = word
        .toLowerCase()
        .replace(/[.,!?،؟]/g, '');

      return numberMap[normalized] ?? word;
    })
    .join(' ')
    .replace(/(?<=\d)\s+(?=\d)/g, '');
}


export function convertDigitsToArabicWords(text: string): string {
  const digitMap: Record<string, string> = {
    '0': ' صفر',
    '1': ' واحد',
    '2': ' اثنان',
    '3': ' ثلاثة',
    '4': ' أربعة',
    '5': ' خمسة',
    '6': ' ستة',
    '7': ' سبعة',
    '8': ' ثمانية',
    '9': ' تسعة',
  };

  return text.replace(/\d/g, (digit) => digitMap[digit]);
}