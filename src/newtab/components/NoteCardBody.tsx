import { useState } from 'react';

interface NoteCardBodyProps {
  content: string;
  onUpdate: (content: string) => void;
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
      rows={6}
      className="w-full bg-transparent outline-none resize-none text-sm px-4 py-3 placeholder-white/30"
      style={{ color: 'var(--newtab-text)' }}
    />
  );
}
