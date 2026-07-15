import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CARD_HEIGHT, CARD_WIDTH, IdCardCanvas, ResponsiveIdCard } from './IdCard';
import { Student } from '../types';

const student: Student = {
  id: '2021/CS/1234',
  docId: '2021-CS-1234',
  name: 'Ada Obi',
  email: 'ada.obi@example.com',
  phone: '08012345678',
  gender: 'Female',
  dob: '2002-05-14',
  bloodGroup: 'O+',
  religion: 'Christianity',
  department: 'Computer Science',
  level: '400 Level',
  admissionYear: 2021,
  passportURL: 'data:image/jpeg;base64,dGVzdA==',
  createdAt: 1735689600000,
  updatedAt: 1735689600000,
  status: 'active',
};

describe('IdCardCanvas', () => {
  it('uses a landscape orientation with CR80 card proportions', () => {
    render(<IdCardCanvas student={student} />);
    const card = screen.getByTestId('id-card-canvas');

    expect(CARD_WIDTH).toBeGreaterThan(CARD_HEIGHT);
    // CR80: 85.6mm x 54mm ≈ 1.585 aspect ratio
    expect(CARD_WIDTH / CARD_HEIGHT).toBeCloseTo(85.6 / 54, 1);
    expect(card).toHaveStyle({ width: `${CARD_WIDTH}px`, height: `${CARD_HEIGHT}px` });
  });

  it('shows every required piece of student information', () => {
    render(<IdCardCanvas student={student} />);

    expect(screen.getByText('Ada Obi')).toBeInTheDocument();
    expect(screen.getByText('2021/CS/1234')).toBeInTheDocument();
    expect(screen.getByText('Computer Science')).toBeInTheDocument();
    expect(screen.getByText('400 Level')).toBeInTheDocument();
    expect(screen.getByText('O+')).toBeInTheDocument();
    expect(screen.getByText('08012345678')).toBeInTheDocument();
    expect(screen.getByText('14/05/2002')).toBeInTheDocument();
    expect(screen.getByAltText('Ada Obi')).toHaveAttribute('src', student.passportURL);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('embeds a verification QR code pointing at the record', () => {
    const { container } = render(<IdCardCanvas student={student} />);
    const qr = container.querySelector('svg[aria-label="Student ID verification QR code"]');
    expect(qr).not.toBeNull();
  });

  it('flags suspended records', () => {
    render(<IdCardCanvas student={{ ...student, status: 'suspended' }} />);
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });
});

describe('ResponsiveIdCard', () => {
  it('renders the scaled screen copy plus a dedicated print copy', () => {
    const { container } = render(<ResponsiveIdCard student={student} />);
    const cards = container.querySelectorAll('[data-testid="id-card-canvas"]');
    expect(cards.length).toBe(2);
    expect(container.querySelector('#id-card-print-area')).not.toBeNull();
  });
});
