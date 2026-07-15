import { describe, expect, it } from 'vitest';
import {
  calculateLevel,
  generateStudentId,
  isEmailIdentifier,
  normalizeRegNo,
  toDocId,
  validateRegNo,
} from './utils';

describe('normalizeRegNo', () => {
  it('trims, uppercases and strips internal whitespace', () => {
    expect(normalizeRegNo('  2021/cs/1234 ')).toBe('2021/CS/1234');
    expect(normalizeRegNo('2021 / cs / 1234')).toBe('2021/CS/1234');
  });
});

describe('toDocId', () => {
  it('replaces slashes with hyphens so the number is a valid document ID', () => {
    expect(toDocId('2021/CS/1234')).toBe('2021-CS-1234');
  });

  it('normalizes before converting, so equivalent inputs map to one document', () => {
    expect(toDocId(' 2021/cs/1234 ')).toBe('2021-CS-1234');
    expect(toDocId('2021/CS/1234')).toBe(toDocId('2021/cs/1234'));
  });

  it('leaves hyphenated and plain numbers unchanged', () => {
    expect(toDocId('2021-CS-1234')).toBe('2021-CS-1234');
    expect(toDocId('20212241234')).toBe('20212241234');
  });
});

describe('validateRegNo', () => {
  it('accepts common COOU formats', () => {
    expect(validateRegNo('2021/CS/1234')).toBeNull();
    expect(validateRegNo('COOU/2021/12345')).toBeNull();
    expect(validateRegNo('20212241234')).toBeNull();
    expect(validateRegNo('2021-LAW-004')).toBeNull();
  });

  it('rejects empty and too-short values', () => {
    expect(validateRegNo('')).toMatch(/required/i);
    expect(validateRegNo('   ')).toMatch(/required/i);
    expect(validateRegNo('12345')).toMatch(/too short/i);
  });

  it('rejects overlong values', () => {
    expect(validateRegNo('1'.repeat(31))).toMatch(/too long/i);
  });

  it('rejects illegal characters and malformed separators', () => {
    expect(validateRegNo('2021_CS_1234')).toMatch(/may only contain/i);
    expect(validateRegNo('2021//CS//1234')).toMatch(/may only contain/i);
    expect(validateRegNo('/2021/CS/1234')).toMatch(/may only contain/i);
    expect(validateRegNo('2021/CS/1234/')).toMatch(/may only contain/i);
  });

  it('requires at least one digit', () => {
    expect(validateRegNo('COOU/CS/ABC')).toMatch(/digit/i);
  });
});

describe('isEmailIdentifier', () => {
  it('detects emails vs registration numbers', () => {
    expect(isEmailIdentifier('student@coou.edu.ng')).toBe(true);
    expect(isEmailIdentifier('2021/CS/1234')).toBe(false);
    expect(isEmailIdentifier('20212241234')).toBe(false);
  });
});

describe('calculateLevel', () => {
  it('maps admission years to levels', () => {
    expect(calculateLevel(2025)).toBe('100 Level');
    expect(calculateLevel(2024)).toBe('200 Level');
    expect(calculateLevel(2023)).toBe('300 Level');
    expect(calculateLevel(2022)).toBe('400 Level');
    expect(calculateLevel(2019)).toBe('Graduate');
  });

  it('falls back to 100 Level for unparseable input', () => {
    expect(calculateLevel('not-a-year')).toBe('100 Level');
  });
});

describe('generateStudentId', () => {
  it('produces a value that passes registration-number validation', () => {
    const generated = generateStudentId('Computer Science', 2024);
    expect(generated.startsWith('2024')).toBe(true);
    expect(validateRegNo(generated)).toBeNull();
  });
});
