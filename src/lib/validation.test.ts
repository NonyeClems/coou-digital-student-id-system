import { describe, expect, it } from 'vitest';
import { validateStudentForm, StudentFormData } from './validation';

const validForm: StudentFormData = {
  name: 'Ada Obi',
  email: 'ada.obi@example.com',
  registrationNumber: '2021/CS/1234',
  department: 'Computer Science',
  admissionYear: 2021,
  passportURL: 'data:image/jpeg;base64,dGVzdA==',
  phone: '08012345678',
  gender: 'Female',
  dob: '2002-05-14',
  bloodGroup: 'O+',
  religion: 'Christianity',
  status: 'active',
};

describe('validateStudentForm', () => {
  it('accepts a fully valid registration', () => {
    expect(validateStudentForm(validForm)).toBeNull();
  });

  it('accepts optional fields left empty', () => {
    expect(validateStudentForm({ ...validForm, phone: '', dob: '' })).toBeNull();
  });

  it('requires a name of at least two characters', () => {
    expect(validateStudentForm({ ...validForm, name: '' })).toMatch(/name/i);
    expect(validateStudentForm({ ...validForm, name: ' A ' })).toMatch(/name/i);
  });

  it('requires a valid email', () => {
    expect(validateStudentForm({ ...validForm, email: '' })).toMatch(/email/i);
    expect(validateStudentForm({ ...validForm, email: 'not-an-email' })).toMatch(/valid email/i);
    expect(validateStudentForm({ ...validForm, email: 'a@b' })).toMatch(/valid email/i);
  });

  it('applies the registration-number rules', () => {
    expect(validateStudentForm({ ...validForm, registrationNumber: '' })).toMatch(/registration number/i);
    expect(validateStudentForm({ ...validForm, registrationNumber: '12' })).toMatch(/too short/i);
    expect(validateStudentForm({ ...validForm, registrationNumber: '2021_CS_1' })).toMatch(/may only contain/i);
  });

  it('bounds the admission year', () => {
    expect(validateStudentForm({ ...validForm, admissionYear: 1980 })).toMatch(/admission year/i);
    expect(validateStudentForm({ ...validForm, admissionYear: 2050 })).toMatch(/admission year/i);
    expect(validateStudentForm({ ...validForm, admissionYear: 0 })).toMatch(/admission year/i);
  });

  it('validates the phone number when provided', () => {
    expect(validateStudentForm({ ...validForm, phone: 'abc' })).toMatch(/phone/i);
    expect(validateStudentForm({ ...validForm, phone: '123' })).toMatch(/phone/i);
    expect(validateStudentForm({ ...validForm, phone: '+2348012345678' })).toBeNull();
    expect(validateStudentForm({ ...validForm, phone: '0801 234 5678' })).toBeNull();
  });

  it('rejects a future date of birth', () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expect(
      validateStudentForm({ ...validForm, dob: nextYear.toISOString().slice(0, 10) })
    ).toMatch(/date of birth/i);
  });

  it('requires a passport photograph', () => {
    expect(validateStudentForm({ ...validForm, passportURL: '' })).toMatch(/photograph/i);
  });
});
