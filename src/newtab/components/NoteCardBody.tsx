import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AppLanguage, SpanValue } from '@core/types/newtab.types';
import { getQuotesForLanguage } from '@core/data/motivational-quotes';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

function getActiveQuoteIndex(quotes: readonly string[], quoteIndex?: number, quoteChangedAt?: string): number {
  if (quoteIndex !== undefined && quoteChangedAt) {
    if (Date.now() - new Date(quoteChangedAt).getTime() < FOUR_HOURS_MS) {
      return quoteIndex % quotes.length;
    }
  }
  return Math.floor(Date.now() / FOUR_HOURS_MS) % quotes.length;
}

interface NoteCardBodyProps {
  content: string;
  onUpdate: (content: string) => void;
  quoteIndex?: number;
  quoteChangedAt?: string;
  onRefreshQuote?: (index: number, changedAt: string) => void;
  language?: AppLanguage;
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function NoteCardBody({
  content,
  onUpdate,
  quoteIndex,
  quoteChangedAt,
  onRefreshQuote,
  language = 'en',
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

  const quotes = getQuotesForLanguage(language);
  const isRtl = language === 'ar';

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    const current = getActiveQuoteIndex(quotes, quoteIndex, quoteChangedAt);
    let next = Math.floor(Math.random() * quotes.length);
    if (quotes.length > 1) {
      while (next === current) next = Math.floor(Math.random() * quotes.length);
    }
    onRefreshQuote?.(next, new Date().toISOString());
  };

  // tick is read so the linter/bundler doesn't strip it — it forces re-render each minute
  void tick;

  const activeQuote = quotes[getActiveQuoteIndex(quotes, quoteIndex, quoteChangedAt)];
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
          className="text-sm italic leading-relaxed select-none pointer-events-none"
          style={{
            color: 'var(--newtab-text-secondary)',
            opacity: 0.65,
            padding: isRtl ? '12px 36px 12px 16px' : '12px 36px 12px 16px',
            direction: isRtl ? 'rtl' : 'ltr',
            textAlign: isRtl ? 'right' : 'left',
          }}
        >
          {activeQuote}
        </p>

        {/* Invisible textarea to capture typing — rendered before button so button stays on top */}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
          className="absolute inset-0 w-full h-full bg-transparent outline-none resize-none text-sm px-4 py-3 opacity-0 focus:opacity-100"
          style={{
            color: 'var(--newtab-text)',
            caretColor: 'var(--newtab-text)',
            direction: isRtl ? 'rtl' : 'ltr',
          }}
          aria-label="Note"
        />

        {/* Refresh button — z-10 keeps it above the textarea overlay */}
        <button
          onClick={handleRefresh}
          className={`absolute top-2 z-10 p-1 rounded hover:bg-white/10 transition-colors ${isRtl ? 'left-2' : 'right-2'}`}
          aria-label="Show another quote"
          title="New quote"
          style={{ opacity: 0.5 }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
        >
          <RefreshCw size={13} style={{ color: 'var(--newtab-text-secondary)' }} />
        </button>
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
      style={{
        color: 'var(--newtab-text)',
        minHeight: '80px',
        direction: isRtl ? 'rtl' : 'ltr',
      }}
    />
  );
}
