import React, { useState } from 'react';
import { Student } from '../types';
import { DEPARTMENTS } from '../constants';
import {
  calculateLevel,
  compressImage,
  generateStudentId,
  normalizeRegNo,
  toDocId,
} from '../lib/utils';
import { validateStudentForm, StudentFormData } from '../lib/validation';
import { checkRegNoAvailability, removeStudent, saveStudent, SaveOutcome } from '../lib/students';
import { AlertCircle, Camera, UserPlus, Wand2 } from 'lucide-react';

/**
 * The single registration workflow shared by student self-enrollment and the
 * admin dashboard. Both modes run the same validation rules
 * (lib/validation.ts) and the same duplicate-registration guard; the admin
 * mode additionally exposes the email and registry-status controls.
 *
 * Saving is offline-first: when the server cannot be reached the record is
 * written to the persistent local cache and the caller is told it is queued
 * (`synced: false`); Firestore pushes it automatically once connectivity
 * returns.
 */

export interface StudentRegistrationFormProps {
  mode: 'student' | 'admin';
  /** Existing record being edited (admin dashboard). Omit when enrolling. */
  initial?: Student | null;
  /** Student mode: the record's email is locked to the signed-in account. */
  lockedEmail?: string;
  /** Prefill for the name field when enrolling. */
  defaultName?: string;
  submitLabel?: string;
  onSaved: (student: Student, outcome: SaveOutcome) => void;
  onCancel: () => void;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const inputClass =
  'w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none ' +
  'focus:ring-2 focus:ring-university-green focus:bg-white transition-all ' +
  'font-bold text-slate-800 disabled:opacity-60 disabled:cursor-not-allowed';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
      {children}
    </label>
  );
}

export function StudentRegistrationForm({
  mode,
  initial,
  lockedEmail,
  defaultName,
  submitLabel,
  onSaved,
  onCancel,
}: StudentRegistrationFormProps) {
  const isEditing = !!initial;
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<StudentFormData>({
    name: initial?.name ?? defaultName ?? '',
    email: initial?.email ?? lockedEmail ?? '',
    registrationNumber: initial?.id ?? '',
    department: initial?.department ?? DEPARTMENTS[0],
    admissionYear: initial?.admissionYear ?? new Date().getFullYear(),
    passportURL: initial?.passportURL ?? '',
    phone: initial?.phone ?? '',
    gender: initial?.gender ?? 'Male',
    dob: initial?.dob ?? '',
    bloodGroup: initial?.bloodGroup ?? 'O+',
    religion: initial?.religion ?? 'Christianity',
    status: initial?.status ?? 'active',
  });

  const set = <K extends keyof StudentFormData>(key: K, value: StudentFormData[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const base64 = await compressImage(file);
      set('passportURL', base64);
    } catch {
      setError('Failed to process the image. Please try a different file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setError('');

    const email = (mode === 'student' ? lockedEmail ?? formData.email : formData.email).trim();
    const candidate: StudentFormData = { ...formData, email };

    const validationError = validateStudentForm(candidate);
    if (validationError) {
      setError(validationError);
      return;
    }

    const regNo = normalizeRegNo(candidate.registrationNumber);
    const docId = toDocId(regNo);
    setIsSaving(true);
    try {
      // Duplicate-registration guard: identical for both workflows. When the
      // number changed during an edit, the new number must also be free.
      if (!isEditing || docId !== initial!.docId) {
        const availability = await checkRegNoAvailability(
          regNo,
          mode === 'student' ? email : null
        );
        if (availability === 'taken') {
          setError(
            'This Registration Number is already registered to another student. ' +
            'Please verify the number and try again.'
          );
          return;
        }
      }

      const now = Date.now();
      const record: Student = {
        id: regNo,
        docId,
        name: candidate.name.trim(),
        email,
        phone: candidate.phone.trim(),
        gender: candidate.gender,
        dob: candidate.dob,
        bloodGroup: candidate.bloodGroup,
        religion: candidate.religion,
        department: candidate.department,
        admissionYear: candidate.admissionYear,
        level: calculateLevel(candidate.admissionYear),
        passportURL: candidate.passportURL,
        status: mode === 'admin' ? candidate.status : initial?.status ?? 'active',
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
      };

      const outcome = await saveStudent(record);
      // The registration number is the document ID; if an admin corrected it
      // during an edit the record moved, so retire the old document.
      if (isEditing && initial!.docId && initial!.docId !== docId) {
        await removeStudent(initial!.docId);
      }
      onSaved(record, outcome);
    } catch (err: any) {
      console.error('Error saving student record:', err);
      setError(
        err?.code === 'permission-denied'
          ? 'You do not have permission to save this record. If it belongs to another student, contact the Registrar.'
          : 'Failed to save the record. Please check your connection and try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold border border-red-100 flex items-center gap-2"
        >
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="space-y-2">
          <FieldLabel>Full Legal Name</FieldLabel>
          <input
            required
            type="text"
            className={inputClass}
            placeholder="Enter Full Legal Name"
            value={formData.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel>Email Address</FieldLabel>
          <input
            required
            type="email"
            className={inputClass}
            placeholder="student@coou.edu.ng"
            value={mode === 'student' ? lockedEmail ?? formData.email : formData.email}
            disabled={mode === 'student'}
            onChange={(e) => set('email', e.target.value)}
          />
          {mode === 'student' && (
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">
              Locked to your signed-in account
            </p>
          )}
        </div>

        <div className="space-y-2">
          <FieldLabel>Registration Number *</FieldLabel>
          <div className="flex gap-2">
            <input
              type="text"
              required
              className={`${inputClass} uppercase flex-1 min-w-0`}
              placeholder="e.g. 2021/CS/1234"
              value={formData.registrationNumber}
              onChange={(e) => set('registrationNumber', e.target.value.toUpperCase())}
            />
            {!isEditing && (
              <button
                type="button"
                title="Generate a registration number"
                onClick={() =>
                  set(
                    'registrationNumber',
                    generateStudentId(formData.department, formData.admissionYear)
                  )
                }
                className="px-3 rounded-xl border border-university-green/30 bg-university-green/5 text-university-green hover:bg-university-green/10 transition-all shrink-0"
              >
                <Wand2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            Your permanent university identifier — used to log in and verify your ID
          </p>
        </div>

        <div className="space-y-2">
          <FieldLabel>Faculty/Department</FieldLabel>
          <select
            className={inputClass}
            value={formData.department}
            onChange={(e) => set('department', e.target.value)}
          >
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <FieldLabel>Admission Year</FieldLabel>
          <input
            type="number"
            required
            min="1990"
            max="2035"
            className={inputClass}
            value={formData.admissionYear || ''}
            onChange={(e) => set('admissionYear', parseInt(e.target.value) || 0)}
          />
          <p className="text-[9px] font-bold text-university-green uppercase tracking-wider ml-1 opacity-80">
            Calculated Level: {calculateLevel(formData.admissionYear)}
          </p>
        </div>

        <div className="space-y-2">
          <FieldLabel>Phone Number</FieldLabel>
          <input
            type="tel"
            className={inputClass}
            placeholder="e.g. 08012345678"
            value={formData.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel>Date of Birth</FieldLabel>
          <input
            type="date"
            className={inputClass}
            value={formData.dob}
            onChange={(e) => set('dob', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel>Gender</FieldLabel>
          <select
            className={inputClass}
            value={formData.gender}
            onChange={(e) => set('gender', e.target.value)}
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        <div className="space-y-2">
          <FieldLabel>Blood Group</FieldLabel>
          <select
            className={inputClass}
            value={formData.bloodGroup}
            onChange={(e) => set('bloodGroup', e.target.value)}
          >
            {BLOOD_GROUPS.map((bg) => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <FieldLabel>Religion</FieldLabel>
          <select
            className={inputClass}
            value={formData.religion}
            onChange={(e) => set('religion', e.target.value)}
          >
            <option value="Christianity">Christianity</option>
            <option value="Islam">Islam</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {mode === 'admin' && (
          <div className="space-y-2">
            <FieldLabel>Registry Status</FieldLabel>
            <select
              className={inputClass}
              value={formData.status}
              onChange={(e) => set('status', e.target.value as Student['status'])}
            >
              <option value="active">Active/Enrolled</option>
              <option value="suspended">Suspended/Withdrawn</option>
              <option value="graduated">Alumni/Graduated</option>
            </select>
          </div>
        )}

        <div className="sm:col-span-2 space-y-2">
          <FieldLabel>Official Passport Photograph *</FieldLabel>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <label className="flex-1 cursor-pointer group">
              <div className="px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl hover:border-university-green hover:bg-university-green/5 transition-all text-center flex items-center justify-center gap-2">
                {isUploading ? (
                  <div className="w-4 h-4 border-2 border-university-green border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-slate-400 group-hover:text-university-green" />
                )}
                <span className="text-xs font-bold text-slate-500 group-hover:text-university-green">
                  {isUploading
                    ? 'Processing Image...'
                    : formData.passportURL
                      ? 'Change Photograph'
                      : 'Upload Image (Auto-compressed)'}
                </span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
            <div className="w-16 h-16 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
              {formData.passportURL ? (
                <img src={formData.passportURL} alt="Passport preview" className="w-full h-full object-cover" />
              ) : (
                <UserPlus className="w-6 h-6 text-slate-300" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-6 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-8 py-4 rounded-xl border border-slate-200 font-bold text-slate-500 hover:bg-slate-50 transition-all uppercase text-xs tracking-widest disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving || isUploading}
          className="flex-1 px-8 py-4 rounded-xl bg-university-green text-white font-bold hover:bg-university-green/90 transition-all shadow-lg shadow-emerald-100 uppercase text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving && (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
          {isSaving
            ? 'Saving...'
            : submitLabel ?? (isEditing ? 'Apply Updates' : 'Submit Registration')}
        </button>
      </div>
    </form>
  );
}
