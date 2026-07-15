import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS classes effectively.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { DEPARTMENT_CODES } from '../constants';

/**
 * Generates a unique student ID.
 * Format: {YEAR}{DEPT_CODE}{RANDOM_4_DIGITS}
 * Example: 20262241234
 */
export function generateStudentId(department: string, year?: number) {
  const y = year || new Date().getFullYear();
  const deptCode = DEPARTMENT_CODES[department] || "000";
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `${y}${deptCode}${randomDigits}`;
}

/**
 * Converts a registration number into a value that is safe to use as a
 * Firestore document ID and as a URL path segment. Firestore document IDs
 * cannot contain forward slashes (common in registration numbers such as
 * "2021/CS/1234"), so they are replaced with hyphens.
 */
export function toDocId(registrationNumber: string) {
  return normalizeRegNo(registrationNumber).replace(/\//g, '-');
}

/**
 * Canonical form of a registration number: trimmed, uppercased, internal
 * whitespace removed. All storage, lookups and comparisons go through this
 * so "2021/cs/1234 " and "2021/CS/1234" resolve to the same student.
 */
export function normalizeRegNo(registrationNumber: string) {
  return registrationNumber.trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Validates a registration number. Accepts the formats in use at COOU:
 * segments of letters/digits separated by "/" or "-" (e.g. "2021/CS/1234",
 * "COOU/2021/12345") as well as plain numeric identifiers ("20212241234").
 * Returns an error message, or null when the number is valid.
 */
export function validateRegNo(registrationNumber: string): string | null {
  const reg = normalizeRegNo(registrationNumber);
  if (!reg) return 'Registration Number is required.';
  if (reg.length < 6) return 'Registration Number is too short (minimum 6 characters).';
  if (reg.length > 30) return 'Registration Number is too long (maximum 30 characters).';
  if (!/^[A-Z0-9]+([/-][A-Z0-9]+)*$/.test(reg)) {
    return 'Registration Number may only contain letters, digits, "/" and "-".';
  }
  if (!/\d/.test(reg)) return 'Registration Number must contain at least one digit.';
  return null;
}

/**
 * Distinguishes the two identifiers accepted at login: an email address or a
 * registration number.
 */
export function isEmailIdentifier(identifier: string) {
  return identifier.includes('@');
}

/**
 * Base URL used inside QR codes so that scanned cards always point at the
 * deployed site. Falls back to the current origin when VITE_APP_BASE_URL is
 * not configured (fine in production, but cards generated on localhost would
 * otherwise encode a localhost URL that no external phone can reach).
 */
export function getVerificationBaseUrl() {
  const configured = import.meta.env.VITE_APP_BASE_URL as string | undefined;
  return (configured || window.location.origin).replace(/\/+$/, '');
}

export function calculateLevel(yearStr: string | number) {
  const y = parseInt(yearStr as string);
  if (isNaN(y)) return "100 Level";
  if (y >= 2025) return "100 Level";
  if (y === 2024) return "200 Level";
  if (y === 2023) return "300 Level";
  if (y === 2022) return "400 Level";
  if (y < 2022) return "Graduate";
  return "100 Level";
}

export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        let scaleSize = 1;
        if (img.width > MAX_WIDTH) {
           scaleSize = MAX_WIDTH / img.width;
        }
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(img.src);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};
export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}
