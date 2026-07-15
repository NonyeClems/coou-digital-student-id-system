import { isEmailIdentifier, normalizeRegNo } from './utils';

/**
 * Resolves a login identifier to the email address Firebase Auth requires.
 * A plain email passes through unchanged; anything else is treated as a
 * registration number — the application's primary student identifier — and
 * resolved against the student registry via the injected lookup.
 *
 * Kept free of Firebase imports so the resolution rules are unit-testable;
 * AuthContext injects the real registry lookup.
 */
export async function resolveLoginEmail(
  identifier: string,
  lookupByRegNo: (regNo: string) => Promise<{ email: string } | null>
): Promise<string> {
  const trimmed = identifier.trim();
  if (isEmailIdentifier(trimmed)) return trimmed;

  const regNo = normalizeRegNo(trimmed);
  const student = await lookupByRegNo(regNo);
  if (!student?.email) {
    throw new Error(
      `No student record was found for registration number "${regNo}". ` +
      'Check the number, or log in with your email address.'
    );
  }
  return student.email;
}
