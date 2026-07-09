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
  return registrationNumber.trim().replace(/\//g, '-');
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
