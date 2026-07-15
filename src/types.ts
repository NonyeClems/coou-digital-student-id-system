/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'staff' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  /**
   * Registration number (in document-ID form) of the linked student record.
   * Set when the account is matched to a registry record so the ID card is
   * looked up by the primary identifier instead of by email.
   */
  studentId?: string;
}

/**
 * A student registry record. The registration number is the PRIMARY
 * IDENTIFIER of the application: the Firestore document ID is
 * `toDocId(id)` (the number with "/" replaced by "-"), which makes the
 * number unique by construction — two records can never hold the same one,
 * including writes replayed by offline synchronization.
 */
export interface Student {
  id: string; // The registration number exactly as issued (normalized, uppercase)
  docId?: string; // Document-ID form of the registration number (slashes → hyphens)
  name: string;
  email: string;
  phone?: string;
  gender?: string;
  dob?: string;
  bloodGroup?: string;
  religion?: string;
  department: string;
  level: string; // Auto-calculated but stored for legacy records
  admissionYear: number;
  passportURL: string;
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'suspended' | 'graduated';
}
