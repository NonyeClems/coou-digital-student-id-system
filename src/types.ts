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
  studentId?: string; // Links to the student record if role is 'student'
}

export interface Student {
  id: string; // The generated student identification number / registration number
  docId?: string; // Legacy field for local storage keys
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
