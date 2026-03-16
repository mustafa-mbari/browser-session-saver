import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { SpanValue } from '@core/types/newtab.types';
import type { WidgetSizeConfig } from '@core/config/widget-config';

const SPANS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface ResizePopoverProps {
  colSpan: SpanValue;
  rowSpan: SpanValue;
  sizeConfig: WidgetSizeConfig;
  anchorRect: DOMRect;
  onResize: (col: SpanValue, row: SpanValue) => void;
  onClose: () => void;
}

export default function ResizePopover({ colSpan, rowSpan, sizeConfig, anchorRect, onResize, onClose }: ResizePopoverProps) {
  const clampedCol = Math.max(sizeConfig.minW, Math.min(sizeConfig.maxW, colSpan)) as SpanValue;
  const clampedRow = Math.max(sizeConfig.minH, Math.min(sizeConfig.maxH, rowSpan)) as SpanValue;

  const [hoverCol, setHoverCol] = useState<SpanValue>(clampedCol);
  const [hoverRow, setHoverRow] = useState<SpanValue>(clampedRow);
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
        onMouseLeave={() => { setHoverCol(clampedCol); setHoverRow(clampedRow); }}
      >
        {SPANS.flatMap((row) =>
          SPANS.map((col) => {
            const outOfRange =
              col < sizeConfig.minW || col > sizeConfig.maxW ||
              row < sizeConfig.minH || row > sizeConfig.maxH;
            const filled = !outOfRange && col <= hoverCol && row <= hoverRow;
            const current = col === clampedCol && row === clampedRow;
            return (
              <button
                key={`${col}-${row}`}
                disabled={outOfRange}
                onMouseEnter={() => {
                  if (!outOfRange) { setHoverCol(col); setHoverRow(row); }
                }}
                onClick={() => {
                  if (!outOfRange) { onResize(col, row); onClose(); }
                }}
                aria-label={outOfRange ? `${col}×${row} (not available)` : `${col}×${row}`}
                className={`w-4 h-4 rounded border transition-all duration-75 ${
                  outOfRange
                    ? 'bg-white/[0.03] border-white/[0.05] opacity-25 cursor-not-allowed'
                    : filled
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
        {sizeConfig.minW}–{sizeConfig.maxW}w × {sizeConfig.minH}–{sizeConfig.maxH}h
      </p>
    </div>,
    document.body,
  );
}
