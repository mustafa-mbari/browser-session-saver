import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus } from 'lucide-react';
import ContextMenu from '@shared/components/ContextMenu';
import type { QuickLink } from '@core/types/newtab.types';
import { useSortableItems } from '@newtab/hooks/useBookmarkDnd';
import { getFaviconUrl, getFaviconInitial } from '@core/utils/favicon';
import { safeOpenUrl } from '@core/utils/safe-open';

function FaviconChip({ url, title }: { url: string; title: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="glass w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:ring-2 group-hover:ring-white/30 shadow-md">
      {!imgFailed ? (
        <img
          src={getFaviconUrl(url)}
          alt=""
          className="w-7 h-7 rounded"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="text-xl font-bold" style={{ color: 'var(--newtab-text)' }}>
          {getFaviconInitial(title, url)}
        </span>
      )}
    </div>
  );
}

interface ChipProps {
  link: QuickLink;
  onEdit: (link: QuickLink) => void;
  onDelete: (id: string) => void;
}

function QuickLinkChip({ link, onEdit, onDelete }: ChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const menuItems = [
    { label: 'Edit', onClick: () => onEdit(link) },
    { label: 'Delete', onClick: () => onDelete(link.id), danger: true },
  ];

  return (
    <ContextMenu items={menuItems}>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className="flex flex-col items-center gap-1 group cursor-pointer"
        onClick={() => safeOpenUrl(link.url, '_self')}
        onAuxClick={(e) => {
          if (e.button === 1) safeOpenUrl(link.url, '_blank');
        }}
      >
        <FaviconChip url={link.url} title={link.title} />
        <span
          className="text-xs truncate max-w-[56px] text-center"
          style={{ color: 'var(--newtab-text-secondary)' }}
        >
          {link.title}
        </span>
      </div>
    </ContextMenu>
  );
}

interface Props {
  links: QuickLink[];
  onAdd: () => void;
  onEdit: (link: QuickLink) => void;
  onDelete: (id: string) => void;
  onReorder: (links: QuickLink[]) => void;
}

export default function QuickLinksRow({ links, onAdd, onEdit, onDelete, onReorder }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const { handleDragEnd: handleDragEndBase } = useSortableItems(links, onReorder);
  const [dragEvent, setDragEvent] = useState<DragEndEvent | null>(null);

  const handleDragEnd = (event: DragEndEvent) => {
    setDragEvent(event);
    handleDragEndBase(event);
  };
  void dragEvent;

  const visible = links.slice(0, 10);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={visible.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex items-start gap-4 flex-wrap justify-center">
          {visible.map((link) => (
            <QuickLinkChip key={link.id} link={link} onEdit={onEdit} onDelete={onDelete} />
          ))}
          <button
            onClick={onAdd}
            className="flex flex-col items-center gap-1 cursor-pointer group"
            aria-label="Add quick link"
          >
            <div className="glass w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-110 shadow-md">
              <Plus size={20} style={{ color: 'var(--newtab-text-secondary)' }} />
            </div>
            <span className="text-xs" style={{ color: 'var(--newtab-text-secondary)' }}>
              Add
            </span>
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}
