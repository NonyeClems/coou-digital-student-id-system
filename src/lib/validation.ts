import { Student } from '../types';
import { validateRegNo } from './utils';

/**
 * The single set of business rules applied to student registration,
 * regardless of who performs it (student self-enrollment or an administrator
 * on the dashboard). Pure functions so the rules are directly unit-testable.
 */

export interface StudentFormData {
  name: string;
  email: string;
  registrationNumber: string;
  department: string;
  admissionYear: number;
  passportURL: string;
  phone: string;
  gender: string;
  dob: string;
  bloodGroup: string;
  religion: string;
  status: Student['status'];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export const MIN_ADMISSION_YEAR = 1990;
export const MAX_ADMISSION_YEAR = 2035;

/** Returns the first violated rule as a user-facing message, or null when valid. */
export function validateStudentForm(data: StudentFormData): string | null {
  if (!data.name.trim() || data.name.trim().length < 2) {
    return 'Please enter the student\'s full legal name.';
  }
  if (!data.email.trim()) {
    return 'Please enter an email address.';
  }
  if (!EMAIL_PATTERN.test(data.email.trim())) {
    return 'Please enter a valid email address.';
  }
  const regNoError = validateRegNo(data.registrationNumber);
  if (regNoError) return regNoError;
  if (!data.department) {
    return 'Please select a faculty/department.';
  }
  if (
    !Number.isInteger(data.admissionYear) ||
    data.admissionYear < MIN_ADMISSION_YEAR ||
    data.admissionYear > MAX_ADMISSION_YEAR
  ) {
    return `Admission year must be between ${MIN_ADMISSION_YEAR} and ${MAX_ADMISSION_YEAR}.`;
  }
  if (data.phone.trim() && !PHONE_PATTERN.test(data.phone.trim().replace(/[\s-]/g, ''))) {
    return 'Please enter a valid phone number (e.g. 08012345678).';
  }
  if (data.dob) {
    const dob = new Date(data.dob);
    if (Number.isNaN(dob.getTime()) || dob.getTime() > Date.now()) {
      return 'Date of birth must be a valid date in the past.';
    }
  }
  if (!data.passportURL) {
    return 'Please upload a passport photograph.';
  }
  return null;
}
