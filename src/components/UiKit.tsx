import { createPortal } from 'react-dom';
import React, { useEffect, useMemo } from 'react';
import { Share2, X } from 'lucide-react';
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

  const node = (
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

            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-4 break-words">{children}</div>

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
  // แสดงนอกโครงหน้า (portal) กันหลุดจอ/ค้างเมื่อถูกเรียกจากภายใน header ที่มี blur/transform
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node;
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

/** Tap-to-view photo lightbox (portal-free fixed overlay) */
export function PhotoLightbox({ src, caption, onClose }: { src: string | null; caption?: string; onClose: () => void }) {
  if (!src) return null;
  return (
    <div
      role="dialog"
      aria-label="ดูรูป"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      className="fixed inset-0 z-[200] bg-black/85 flex flex-col items-center justify-center p-4 gap-3"
    >
      <button type="button" aria-label="ปิด" onClick={(e) => { e.stopPropagation(); onClose(); }} className="absolute top-3 right-3 w-11 h-11 rounded-full bg-white/15 text-white text-xl">✕</button>
      <img src={src} alt={caption || ''} className="max-w-full max-h-[80vh] object-contain rounded-xl" />
      {caption && <div className="text-white text-sm font-semibold">{caption}</div>}
    </div>
  );
}

/** Round avatar that opens the lightbox when tapped */
export function PhotoThumb({ photo, name, size = 44, className = '' }: { photo?: string | null; name?: string; size?: number; className?: string }) {
  const [open, setOpen] = React.useState(false);
  const src = photo ? photoUrl(photo) : '';
  if (!src)
    return (
      <span style={{ width: size, height: size }} className={`rounded-full ring-2 ring-white bg-slate-200 text-slate-500 grid place-items-center text-xs font-bold shrink-0 ${className}`}>
        {[...(name || '?')][0]}
      </span>
    );
  return (
    <>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} aria-label={`ดูรูป ${name || ''}`} className="shrink-0 rounded-full">
        <img src={src} alt={name || ''} style={{ width: size, height: size }} className={`rounded-full object-cover ring-2 ring-white bg-slate-100 ${className}`} />
      </button>
      <PhotoLightbox src={open ? src : null} caption={name} onClose={() => setOpen(false)} />
    </>
  );
}

export function TeamAvatars({ reg, size = 36, flat = false }: { reg?: Registration | null; size?: number; flat?: boolean }) {
  if (!reg) return null;
  const people = [
    { n: reg.p1_name, ph: reg.p1_photo },
    ...(reg.p2_name ? [{ n: reg.p2_name, ph: reg.p2_photo }] : []),
  ];
  return (
    <span className={`inline-flex shrink-0 align-middle ${flat ? "gap-1" : "-space-x-2"}`}>
      {people.map((p, i) => (
        <PhotoThumb key={i} photo={p.ph} name={p.n} size={size} />
      ))}
    </span>
  );
}

/** สไลด์โปสเตอร์หลายรูป (เลื่อนซ้าย-ขวา) แตะเพื่อขยาย */
export function PosterSlider({ images, onZoom, maxH = 420 }: { images: string[]; onZoom?: (i: number) => void; maxH?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [idx, setIdx] = React.useState(0);
  if (!images.length) return null;
  return (
    <div className="relative bg-slate-100">
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {images.map((src, i) => (
          <button key={i} type="button" onClick={() => onZoom?.(i)} className="snap-center shrink-0 w-full grid place-items-center" aria-label={`โปสเตอร์ ${i + 1}`}>
            <img src={src} alt={`โปสเตอร์ ${i + 1}`} style={{ maxHeight: maxH }} className="w-full object-contain" />
          </button>
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
          {images.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-slate-800' : 'w-1.5 bg-slate-400/70'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/** เลขแมตช์ — ป้ายเด่น ใช้ทุกที่ที่แสดงเลขแมตช์ */
export function MatchNo({ n, className = '' }: { n?: number | null; className?: string }) {
  if (!n) return null;
  return (
    <span className={`inline-flex items-center rounded-md bg-blue-600 text-white px-1.5 py-0.5 text-xs font-extrabold tabular-nums leading-none shrink-0 ${className}`}>
      แมตช์ #{n}
    </span>
  );
}

/** ปุ่มแชร์รายการแข่ง: เปิดหน้าต่างแชร์ของเครื่อง (LINE/Facebook ฯลฯ) ถ้าไม่รองรับให้คัดลอกลิงก์ */
export function ShareButton({ tid, name, page, label = 'แชร์', compact = false, onDone }: { tid: string; name: string; page?: string; label?: string; compact?: boolean; onDone?: (msg: string) => void }) {
  const go = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?t=${encodeURIComponent(tid)}${page ? `&p=${page}` : ''}`;
    const text = `ร่วมแข่งขัน/ติดตามผล "${name}" บน MatchON`;
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text, url });
        return;
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      onDone?.('คัดลอกลิงก์แล้ว');
    } catch {
      window.prompt('คัดลอกลิงก์นี้', url);
    }
  };
  return (
    <button
      type="button"
      onClick={go}
      aria-label={`แชร์ ${name}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-700 text-slate-700 text-xs font-semibold ${compact ? 'min-h-[36px] px-3' : 'min-h-[42px] px-4'}`}
    >
      <Share2 className="w-4 h-4" />
      {label}
    </button>
  );
}
