import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SpanValue } from '@core/types/newtab.types';

const SPANS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface ResizePopoverProps {
  colSpan: SpanValue;
  rowSpan: SpanValue;
  anchorRect: DOMRect;
  onResize: (col: SpanValue, row: SpanValue) => void;
  onClose: () => void;
}

export default function ResizePopover({ colSpan, rowSpan, anchorRect, onResize, onClose }: ResizePopoverProps) {
  const [hoverCol, setHoverCol] = useState<SpanValue>(colSpan);
  const [hoverRow, setHoverRow] = useState<SpanValue>(rowSpan);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const top = anchorRect.bottom + 6;
  const right = window.innerWidth - anchorRect.right;

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, right, zIndex: 9999, backgroundColor: 'rgba(15,15,30,0.92)', backdropFilter: 'blur(20px)' }}
      className="rounded-xl p-3 shadow-2xl border border-white/10"
    >
      <p className="text-xs text-center mb-2.5 font-medium tabular-nums" style={{ color: 'var(--newtab-text-secondary)' }}>
        <span style={{ color: 'var(--newtab-text)' }}>{hoverCol}w × {hoverRow}h</span>
      </p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: 'repeat(9, 1fr)' }}
        onMouseLeave={() => { setHoverCol(colSpan); setHoverRow(rowSpan); }}
      >
        {SPANS.flatMap((row) =>
          SPANS.map((col) => {
            const filled = col <= hoverCol && row <= hoverRow;
            const current = col === colSpan && row === rowSpan;
            return (
              <button
                key={`${col}-${row}`}
                onMouseEnter={() => { setHoverCol(col); setHoverRow(row); }}
                onClick={() => { onResize(col, row); onClose(); }}
                aria-label={`${col}×${row}`}
                className={`w-4 h-4 rounded border transition-all duration-75 ${
                  filled
                    ? 'bg-indigo-500/70 border-indigo-400/90'
                    : current
                    ? 'bg-white/10 border-white/50'
                    : 'bg-white/5 border-white/15 hover:border-white/30'
                }`}
              />
            );
          }),
        )}
      </div>
      <p className="text-[10px] text-center mt-2 opacity-40" style={{ color: 'var(--newtab-text)' }}>
        width × height
      </p>
    </div>,
    document.body,
  );
}
