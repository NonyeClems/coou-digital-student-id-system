import { describe, expect, it, vi } from 'vitest';
import { resolveLoginEmail } from './login';

describe('resolveLoginEmail', () => {
  it('passes an email identifier straight through without a registry lookup', async () => {
    const lookup = vi.fn();
    await expect(resolveLoginEmail('student@coou.edu.ng', lookup)).resolves.toBe(
      'student@coou.edu.ng'
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('trims whitespace around an email', async () => {
    await expect(resolveLoginEmail('  a@b.com  ', vi.fn())).resolves.toBe('a@b.com');
  });

  it('resolves a registration number to the email on the student record', async () => {
    const lookup = vi.fn().mockResolvedValue({ email: 'ada.obi@example.com' });
    await expect(resolveLoginEmail('2021/CS/1234', lookup)).resolves.toBe('ada.obi@example.com');
    expect(lookup).toHaveBeenCalledWith('2021/CS/1234');
  });

  it('normalizes the registration number before the lookup', async () => {
    const lookup = vi.fn().mockResolvedValue({ email: 'x@y.com' });
    await resolveLoginEmail('  2021/cs/1234 ', lookup);
    expect(lookup).toHaveBeenCalledWith('2021/CS/1234');
  });

  it('throws a clear error when no record matches the registration number', async () => {
    const lookup = vi.fn().mockResolvedValue(null);
    await expect(resolveLoginEmail('2021/CS/9999', lookup)).rejects.toThrow(
      /No student record was found for registration number "2021\/CS\/9999"/
    );
  });

  it('throws when the record exists but carries no email', async () => {
    const lookup = vi.fn().mockResolvedValue({ email: '' });
    await expect(resolveLoginEmail('2021/CS/1234', lookup)).rejects.toThrow(/No student record/);
  });
});
