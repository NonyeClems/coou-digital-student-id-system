import { forwardRef, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { IdCard as IdCardIcon, MapPin, ShieldCheck } from 'lucide-react';
import { Student } from '../types';
import { cn, formatDate, getVerificationBaseUrl, toDocId } from '../lib/utils';
import { UNIVERSITY_NAME } from '../constants';

/**
 * The digital student ID card, in landscape orientation using the standard
 * CR80 card proportions (85.6mm x 54mm). The card is laid out once on a
 * fixed-size design canvas (856x540 px) and scaled uniformly to fit its
 * container, so the layout is pixel-identical on a phone, a laptop, in the
 * downloaded PNG and in print — it can never reflow or distort.
 */

export const CARD_WIDTH = 856;
export const CARD_HEIGHT = 540;

function verificationUrl(student: Student) {
  return `${getVerificationBaseUrl()}/verify/${encodeURIComponent(student.docId || toDocId(student.id))}`;
}

function CardDetail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn('min-w-0', wide && 'col-span-2')}>
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.18em] leading-none mb-[6px]">
        {label}
      </p>
      <p className="text-[17px] font-black text-slate-800 uppercase tracking-tight leading-tight truncate">
        {value}
      </p>
    </div>
  );
}

/** The card artwork at its fixed design size. Capture/print this node. */
export const IdCardCanvas = forwardRef<HTMLDivElement, { student: Student }>(
  function IdCardCanvas({ student }, ref) {
    const suspended = student.status === 'suspended';
    return (
      <div
        ref={ref}
        data-testid="id-card-canvas"
        style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
        className={cn(
          'relative bg-white overflow-hidden rounded-[28px] border-2 flex flex-col text-left',
          student.status === 'active'
            ? 'border-university-green/25'
            : 'border-slate-300 grayscale-[0.6]'
        )}
      >
        {/* Header band */}
        <div className="relative h-[104px] bg-university-green shrink-0 flex items-center gap-[18px] px-[28px] overflow-hidden">
          <div className="absolute -top-[90px] -right-[60px] w-[260px] h-[260px] bg-university-yellow/10 rounded-full" />
          <div className="absolute -bottom-[70px] left-[240px] w-[140px] h-[140px] bg-white/5 rounded-full" />
          <div className="w-[60px] h-[60px] rounded-[18px] bg-white flex items-center justify-center shrink-0 shadow-lg">
            <IdCardIcon className="w-[34px] h-[34px] text-university-green" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-[21px] font-black uppercase tracking-tight leading-tight truncate">
              {UNIVERSITY_NAME}
            </p>
            <p className="text-university-yellow text-[12px] font-black uppercase tracking-[0.35em] mt-[4px]">
              Student Identity Card
            </p>
          </div>
          <div
            className={cn(
              'shrink-0 px-[16px] py-[8px] rounded-full border-2 border-white/40 text-[11px] font-black uppercase tracking-[0.2em]',
              student.status === 'active'
                ? 'bg-university-yellow text-university-green'
                : suspended
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-200 text-slate-700'
            )}
          >
            {student.status === 'active' ? 'Active' : suspended ? 'Suspended' : 'Alumni'}
          </div>
        </div>

        {/* Watermark */}
        <div className="absolute inset-x-0 top-[104px] bottom-[46px] flex items-center justify-center pointer-events-none select-none">
          <IdCardIcon className="w-[300px] h-[300px] text-university-green/[0.04]" />
        </div>

        {/* Body */}
        <div className="relative flex-1 flex items-stretch gap-[26px] px-[28px] py-[22px] min-h-0">
          {/* Photo */}
          <div className="shrink-0 flex flex-col items-center gap-[12px]">
            <div className="p-[6px] bg-white rounded-[20px] shadow-xl ring-2 ring-university-green/15">
              <img
                src={student.passportURL}
                alt={student.name}
                crossOrigin="anonymous"
                className="w-[176px] h-[216px] object-cover rounded-[14px] bg-slate-100"
              />
            </div>
            <div className="flex items-center gap-[6px] text-university-green">
              <ShieldCheck className="w-[16px] h-[16px]" />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">Verified</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] leading-none mb-[6px]">
                Student Name
              </p>
              <h3 className="text-[30px] font-black text-slate-900 uppercase tracking-tighter leading-[1.05] break-words">
                {student.name}
              </h3>
            </div>

            <div className="mt-[14px] inline-flex self-start items-center gap-[12px] bg-university-green/5 border border-university-green/15 rounded-[14px] px-[16px] py-[9px]">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Reg. No.</p>
              <p className="text-[22px] font-black font-mono text-university-green tracking-tight leading-none">
                {student.id}
              </p>
            </div>

            <div className="mt-[20px] grid grid-cols-2 gap-x-[20px] gap-y-[16px]">
              <CardDetail label="Department" value={student.department} wide />
              <CardDetail label="Level" value={student.level} />
              <CardDetail label="Blood Group" value={student.bloodGroup || 'N/A'} />
              <CardDetail
                label="Date of Birth"
                value={student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : 'N/A'}
              />
              <CardDetail label="Phone" value={student.phone || 'N/A'} />
            </div>
          </div>

          {/* QR + signature */}
          <div className="shrink-0 w-[168px] flex flex-col items-center justify-between">
            <div className="bg-white p-[10px] rounded-[18px] border-2 border-university-green/15 shadow-sm">
              <QRCodeSVG
                value={verificationUrl(student)}
                size={140}
                level="H"
                aria-label="Student ID verification QR code"
              />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-[8px]">
              Scan to verify
            </p>
            <div className="w-full mt-auto pt-[10px] text-center">
              <div className="border-t-2 border-slate-300 border-dotted pt-[6px]">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Registrar</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative shrink-0">
          <div className="flex items-center justify-between px-[28px] pb-[10px]">
            <div className="flex items-center gap-[6px] text-[10px] font-black text-university-green/60 uppercase tracking-[0.2em]">
              <MapPin className="w-[13px] h-[13px]" />
              COOU Main Campus, Uli — Anambra State
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
              Issued {formatDate(student.createdAt)} · Valid for the duration of studentship
            </p>
          </div>
          <div className="h-[14px] bg-linear-to-r from-university-green via-university-yellow to-university-green" />
        </div>
      </div>
    );
  }
);

/**
 * Responsive on-screen presentation: scales the fixed-size canvas to the
 * available width (never reflows), and renders a separate unscaled copy used
 * exclusively by the browser's print flow (see @media print in index.css).
 */
export function ResponsiveIdCard({
  student,
  captureRef,
}: {
  student: Student;
  captureRef?: React.Ref<HTMLDivElement>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(el.clientWidth / CARD_WIDTH, 1));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={containerRef} className="w-full">
        <div
          style={{ height: scale > 0 ? CARD_HEIGHT * scale : undefined }}
          className="relative"
          aria-label={`Student ID card for ${student.name}`}
        >
          <div
            style={{
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              transform: `scale(${scale || 1})`,
              transformOrigin: 'top left',
              visibility: scale > 0 ? 'visible' : 'hidden',
            }}
          >
            <div className="shadow-2xl rounded-[28px]">
              <IdCardCanvas student={student} ref={captureRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Print-only, unscaled copy — the print stylesheet isolates this node. */}
      <div id="id-card-print-area" aria-hidden="true" className="hidden">
        <IdCardCanvas student={student} />
      </div>
    </>
  );
}
