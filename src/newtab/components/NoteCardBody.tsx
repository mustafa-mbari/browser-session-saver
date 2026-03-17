import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { SpanValue } from '@core/types/newtab.types';
import { MOTIVATIONAL_QUOTES } from '@core/data/motivational-quotes';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function getActiveQuoteIndex(quoteIndex?: number, quoteChangedAt?: string): number {
  if (quoteIndex !== undefined && quoteChangedAt) {
    if (Date.now() - new Date(quoteChangedAt).getTime() < FOUR_HOURS_MS) {
      return quoteIndex;
    }
  }
  return Math.floor(Date.now() / FOUR_HOURS_MS) % MOTIVATIONAL_QUOTES.length;
}

interface NoteCardBodyProps {
  content: string;
  onUpdate: (content: string) => void;
  quoteIndex?: number;
  quoteChangedAt?: string;
  onRefreshQuote?: (index: number, changedAt: string) => void;
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function NoteCardBody({
  content,
  onUpdate,
  quoteIndex,
  quoteChangedAt,
  onRefreshQuote,
}: NoteCardBodyProps) {
  const [draft, setDraft] = useState(content);
  const [tick, setTick] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-evaluate quote every minute to handle 4-hour auto-rotation while tab stays open
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Keep draft in sync when content changes externally (e.g. duplicate widget)
  useEffect(() => {
    setDraft(content);
  }, [content]);

  const handleBlur = () => {
    if (draft !== content) onUpdate(draft);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = getActiveQuoteIndex(quoteIndex, quoteChangedAt);
    let next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    if (MOTIVATIONAL_QUOTES.length > 1) {
      while (next === current) next = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    }
    onRefreshQuote?.(next, new Date().toISOString());
  };

  // tick is read so the linter/bundler doesn't strip it — it forces re-render each minute
  void tick;

  const activeQuote = MOTIVATIONAL_QUOTES[getActiveQuoteIndex(quoteIndex, quoteChangedAt)];
  const isEmpty = draft === '';

  if (isEmpty) {
    return (
      <div
        className="relative w-full h-full"
        style={{ minHeight: '80px' }}
        onClick={() => textareaRef.current?.focus()}
      >
        {/* Quote display */}
        <p
          className="text-sm italic px-4 py-3 pr-9 leading-relaxed select-none pointer-events-none"
          style={{ color: 'var(--newtab-text-secondary)', opacity: 0.65 }}
        >
          {activeQuote}
        </p>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Show another quote"
          title="New quote"
          style={{ opacity: 0.5 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
        >
          <RefreshCw size={13} style={{ color: 'var(--newtab-text-secondary)' }} />
        </button>

        {/* Invisible textarea to capture typing */}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          className="absolute inset-0 w-full h-full bg-transparent outline-none resize-none text-sm px-4 py-3 opacity-0 focus:opacity-100"
          style={{ color: 'var(--newtab-text)', caretColor: 'var(--newtab-text)' }}
          aria-label="Note"
        />
      </div>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      placeholder="Write your note here…"
      className="w-full h-full bg-transparent outline-none resize-none text-sm px-4 py-3 placeholder-white/30"
      style={{ color: 'var(--newtab-text)', minHeight: '80px' }}
    />
  );
}
