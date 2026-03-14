import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Inbox } from 'lucide-react';
import type { Session } from '@core/types/session.types';
import type { ToastData } from '@shared/components/Toast';
import EmptyState from '@shared/components/EmptyState';
import LoadingSpinner from '@shared/components/LoadingSpinner';
import Button from '@shared/components/Button';
import { useSession } from '@shared/hooks/useSession';
import SessionCard from './SessionCard';

interface SessionListProps {
  sessions: Session[];
  loading: boolean;
  onToast?: (toast: Omit<ToastData, 'id'>) => void;
}

export default function SessionList({ sessions, loading, onToast }: SessionListProps) {
  const { saveSession } = useSession();
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  const handleToast = useCallback(
    (toast: Omit<ToastData, 'id'>) => {
      onToast?.(toast);
    },
    [onToast],
  );

  if (loading) {
    return <LoadingSpinner />;
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No sessions saved"
        description="Save your current tabs to get started. Sessions will appear here."
        action={<Button size="sm" onClick={() => saveSession()}>Save Session</Button>}
      />
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <SessionCard session={sessions[virtualItem.index]} onToast={handleToast} />
          </div>
        ))}
      </div>
    </div>
  );
}
