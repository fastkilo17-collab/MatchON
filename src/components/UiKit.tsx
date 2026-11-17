import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import QRCode from 'qrcode';
import { photoUrl } from '../lib/supabase';
import type { Registration } from '../types/matchon';

/**
 * Mobile-first Bottom Sheet on small screens, clean centered Modal on desktop.
 */
export function ResponsiveSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative z-10 w-full sm:max-w-lg max-h-[90dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden"
          >
            {/* Mobile drag affordance */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-slate-300" />
            </div>

            <div className="flex items-start justify-between gap-4 px-5 py-3.5 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="ปิดหน้าต่าง"
                className="min-h-[44px] min-w-[44px] -mr-2 -my-2 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{children}</div>

            {footer && (
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/70 pb-safe shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function QrCodeSvg({ value, size = 160 }: { value: string; size?: number }) {
  const { n, data } = useMemo(() => {
    try {
      const q = QRCode.create(value, { errorCorrectionLevel: 'M' });
      return { n: q.modules.size as number, data: q.modules.data as Uint8Array };
    } catch {
      return { n: 0, data: new Uint8Array() };
    }
  }, [value]);
  const quiet = 3;
  const total = n + quiet * 2;
  const path: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (data[r * n + c]) path.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      className="bg-white rounded-xl border border-slate-200"
      role="img"
      aria-label="QR Code"
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#FFFFFF" />
      <path d={path.join('')} fill="#0F172A" />
    </svg>
  );
}

export function ToastStack({
  toasts,
}: {
  toasts: Array<{ id: string; text: string; tone: 'ok' | 'err' | 'info' }>;
}) {
  return (
    <div
      aria-live="polite"
      className="fixed top-16 sm:top-5 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 pointer-events-none sm:w-80"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto ${
              t.tone === 'err'
                ? 'bg-red-50 border-red-200 text-red-800'
                : t.tone === 'info'
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-white border-emerald-200 text-slate-900'
            }`}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function TeamAvatars({ reg, size = 36 }: { reg?: Registration | null; size?: number }) {
  if (!reg) return null;
  const people = [
    { n: reg.p1_name, ph: reg.p1_photo },
    ...(reg.p2_name ? [{ n: reg.p2_name, ph: reg.p2_photo }] : []),
  ];
  return (
    <span className="inline-flex -space-x-2 shrink-0 align-middle">
      {people.map((p, i) =>
        p.ph ? (
          <img
            key={i}
            src={photoUrl(p.ph)}
            alt={p.n}
            style={{ width: size, height: size }}
            className="rounded-full object-cover ring-2 ring-white bg-slate-100"
          />
        ) : (
          <span
            key={i}
            style={{ width: size, height: size }}
            className="rounded-full ring-2 ring-white bg-slate-200 text-slate-500 grid place-items-center text-xs font-bold"
          >
            {[...(p.n || '?')][0]}
          </span>
        ),
      )}
    </span>
  );
}
