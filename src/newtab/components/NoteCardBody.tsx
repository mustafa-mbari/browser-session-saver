import { useState } from 'react';
import type { SpanValue } from '@core/types/newtab.types';

interface NoteCardBodyProps {
  content: string;
  onUpdate: (content: string) => void;
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function NoteCardBody({ content, onUpdate }: NoteCardBodyProps) {
  const [draft, setDraft] = useState(content);

  const handleBlur = () => {
    if (draft !== content) onUpdate(draft);
  };

  return (
    <textarea
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      placeholder="Write your note here…"
      className="w-full h-full bg-transparent outline-none resize-none text-sm px-4 py-3 placeholder-white/30"
      style={{ color: 'var(--newtab-text)', minHeight: '80px' }}
    />
  );
}
