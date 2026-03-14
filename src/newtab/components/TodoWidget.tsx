import { useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TodoItem, TodoList } from '@core/types/newtab.types';
import { useSortableItems } from '@newtab/hooks/useBookmarkDnd';
import { formatRelative } from '@core/utils/date';

interface TodoItemRowProps {
  item: TodoItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f97316',
  low: '#22c55e',
  none: 'transparent',
};

function TodoItemRow({ item, onToggle, onDelete }: TodoItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const isOverdue =
    !item.completed && item.dueDate && new Date(item.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? CSS.Transform.toString(transform) : undefined,
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 py-1.5 group"
    >
      <div
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-40 cursor-grab"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} style={{ color: 'var(--newtab-text)' }} />
      </div>
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: PRIORITY_COLORS[item.priority] }}
      />
      <button
        onClick={() => onToggle(item.id)}
        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
          item.completed
            ? 'bg-green-500 border-green-500'
            : 'border-white/30 hover:border-white/60'
        }`}
        aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {item.completed && <Check size={10} className="text-white" />}
      </button>
      <span
        className={`flex-1 text-sm ${item.completed ? 'line-through opacity-40' : ''}`}
        style={{ color: isOverdue ? '#f87171' : 'var(--newtab-text)' }}
      >
        {item.text}
      </span>
      {item.dueDate && !item.completed && (
        <span className="text-xs shrink-0" style={{ color: isOverdue ? '#f87171' : 'var(--newtab-text-secondary)' }}>
          {formatRelative(item.dueDate)}
        </span>
      )}
      <button
        onClick={() => onDelete(item.id)}
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Delete todo"
      >
        <Trash2 size={13} style={{ color: 'var(--newtab-text-secondary)' }} />
      </button>
    </div>
  );
}

interface Props {
  lists: TodoList[];
  items: TodoItem[];
  activeListId: string | null;
  onListChange: (id: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onReorder: (listId: string, orderedIds: string[]) => void;
}

export default function TodoWidget({
  lists,
  items,
  activeListId,
  onListChange,
  onAddItem,
  onToggleItem,
  onDeleteItem,
  onReorder,
}: Props) {
  const [newText, setNewText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeItems = items.filter((i) => !i.completed);
  const completedItems = items.filter((i) => i.completed);
  const [showCompleted, setShowCompleted] = useState(false);

  const { handleDragEnd } = useSortableItems(activeItems, (reordered) => {
    if (activeListId) onReorder(activeListId, reordered.map((i) => i.id));
  });

  const rowHeight = 36;
  const virtualizer = useVirtualizer({
    count: activeItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  const handleAdd = () => {
    if (!newText.trim() || !activeListId) return;
    onAddItem(activeListId, newText.trim());
    setNewText('');
  };

  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--newtab-text)' }}>
          To-Do
        </h3>
        {lists.length > 1 && (
          <div className="flex gap-1">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => onListChange(list.id)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  list.id === activeListId ? 'bg-white/20' : 'hover:bg-white/10'
                }`}
                style={{ color: 'var(--newtab-text)' }}
              >
                {list.icon} {list.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeItems.length > 50 ? (
        <div
          ref={scrollRef}
          style={{ height: Math.min(activeItems.length * rowHeight, 280), overflow: 'auto' }}
        >
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={activeItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                {virtualizer.getVirtualItems().map((vItem) => {
                  const item = activeItems[vItem.index];
                  return (
                    <div
                      key={vItem.key}
                      style={{
                        position: 'absolute',
                        top: vItem.start,
                        height: vItem.size,
                        width: '100%',
                      }}
                    >
                      <TodoItemRow
                        item={item}
                        onToggle={onToggleItem}
                        onDelete={onDeleteItem}
                      />
                    </div>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext
            items={activeItems.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col max-h-64 overflow-y-auto">
              {activeItems.map((item) => (
                <TodoItemRow
                  key={item.id}
                  item={item}
                  onToggle={onToggleItem}
                  onDelete={onDeleteItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {completedItems.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="text-xs mb-1 opacity-60 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--newtab-text)' }}
          >
            {showCompleted ? '▾' : '▸'} Completed ({completedItems.length})
          </button>
          {showCompleted && (
            <div className="flex flex-col gap-1">
              {completedItems.map((item) => (
                <TodoItemRow
                  key={item.id}
                  item={item}
                  onToggle={onToggleItem}
                  onDelete={onDeleteItem}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <input
          ref={inputRef}
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add a task…"
          className="flex-1 bg-white/10 rounded-lg px-3 py-1.5 text-sm outline-none placeholder-white/30 focus:bg-white/15"
          style={{ color: 'var(--newtab-text)' }}
          aria-label="New todo item"
        />
        <button
          onClick={handleAdd}
          disabled={!newText.trim()}
          className="glass w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-30 hover:bg-white/20 transition-colors"
          aria-label="Add todo"
        >
          <Plus size={16} style={{ color: 'var(--newtab-text)' }} />
        </button>
      </div>
    </div>
  );
}
