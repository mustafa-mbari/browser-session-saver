import { useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { generateId } from '@core/utils/uuid';
import { deleteTodoItem } from '@core/services/todo.service';
import type { SpanValue } from '@core/types/newtab.types';

interface TodoCardItem { id: string; text: string; done: boolean; }

interface TodoCardBodyProps {
  rawContent: string;
  onUpdate: (content: string) => void;
  colSpan: SpanValue;
  rowSpan: SpanValue;
}

export default function TodoCardBody({ rawContent, onUpdate }: TodoCardBodyProps) {
  const items: TodoCardItem[] = useMemo(() => {
    try { return JSON.parse(rawContent || '[]') as TodoCardItem[]; }
    catch { return []; }
  }, [rawContent]);

  const [newText, setNewText] = useState('');

  const save = useCallback((next: TodoCardItem[]) => {
    onUpdate(JSON.stringify(next));
  }, [onUpdate]);

  const toggle = (id: string) =>
    save(items.map((it) => it.id === id ? { ...it, done: !it.done } : it));

  const remove = (id: string) => {
    save(items.filter((it) => it.id !== id));
    // Also delete from IDB + record tombstone so the next sync doesn't
    // re-hydrate the item from remote back into noteContent.
    void deleteTodoItem(id);
  };

  const add = () => {
    const text = newText.trim();
    if (!text) return;
    save([...items, { id: generateId(), text, done: false }]);
    setNewText('');
  };

  const doneCount = items.filter((it) => it.done).length;

  return (
    <div className="flex flex-col px-3 pb-3 gap-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2 group py-0.5">
          <button
            onClick={() => toggle(item.id)}
            className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
              item.done ? 'bg-indigo-500 border-indigo-500' : 'border-white/30 hover:border-white/60'
            }`}
            aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
          >
            {item.done && <Check size={10} color="white" />}
          </button>
          <span
            className={`flex-1 text-sm truncate ${item.done ? 'line-through opacity-50' : ''}`}
            style={{ color: 'var(--newtab-text)' }}
          >
            {item.text}
          </span>
          <button
            onClick={() => remove(item.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/10"
            aria-label="Remove item"
          >
            <Trash2 size={11} style={{ color: 'rgba(255,100,100,0.7)' }} />
          </button>
        </div>
      ))}

      {items.length > 0 && (
        <p className="text-[10px] opacity-40 mt-0.5" style={{ color: 'var(--newtab-text-secondary)' }}>
          {doneCount}/{items.length} done
        </p>
      )}

      <div className="flex items-center gap-1 mt-1">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add item…"
          className="flex-1 bg-white/10 rounded px-2 py-1 text-xs outline-none placeholder-white/30"
          style={{ color: 'var(--newtab-text)' }}
        />
        <button
          onClick={add}
          disabled={!newText.trim()}
          className="p-1 rounded hover:bg-white/15 transition-colors disabled:opacity-30"
          aria-label="Add item"
        >
          <Plus size={13} style={{ color: 'var(--newtab-text)' }} />
        </button>
      </div>
    </div>
  );
}
