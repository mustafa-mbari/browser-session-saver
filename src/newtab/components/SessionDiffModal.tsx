import { X } from 'lucide-react';
import type { Session, Tab } from '@core/types/session.types';
import type { SessionDiffResponse } from '@core/types/messages.types';

interface SessionDiffModalProps {
  diffResult: SessionDiffResponse | null;
  sessions: [Session, Session] | null;
  onClose: () => void;
}

function TabRow({ tab, bg }: { tab: Tab; bg: string }) {
  return (
    <li
      className="flex items-center gap-2 px-2 py-1 rounded text-xs"
      style={{ background: bg }}
    >
      {tab.favIconUrl && (
        <img src={tab.favIconUrl} alt="" className="w-4 h-4 shrink-0 rounded-sm" />
      )}
      <span className="truncate" style={{ color: 'var(--newtab-text)' }}>
        {tab.title || tab.url}
      </span>
    </li>
  );
}

export default function SessionDiffModal({ diffResult, sessions, onClose }: SessionDiffModalProps) {
  if (!sessions) return null;

  const title = `Compare: ${sessions[0].name} vs ${sessions[1].name}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[520px] max-h-[80vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(16, 16, 36, 0.97)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h2 className="text-sm font-semibold truncate" style={{ color: 'var(--newtab-text)' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ml-2"
            style={{ color: 'rgba(255,255,255,0.5)' }}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          {!diffResult && (
            <p style={{ color: 'rgba(255,255,255,0.4)' }}>Loading diff…</p>
          )}

          {diffResult && diffResult.added.length === 0 && diffResult.removed.length === 0 && (
            <p className="text-center py-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Sessions are identical
            </p>
          )}

          {diffResult && diffResult.added.length > 0 && (
            <section>
              <p className="text-xs font-semibold mb-2" style={{ color: '#4ade80' }}>
                + Added ({diffResult.added.length})
              </p>
              <ul className="space-y-1">
                {diffResult.added.map((tab) => (
                  <TabRow key={tab.id} tab={tab} bg="rgba(74,222,128,0.08)" />
                ))}
              </ul>
            </section>
          )}

          {diffResult && diffResult.removed.length > 0 && (
            <section>
              <p className="text-xs font-semibold mb-2" style={{ color: '#f87171' }}>
                − Removed ({diffResult.removed.length})
              </p>
              <ul className="space-y-1">
                {diffResult.removed.map((tab) => (
                  <TabRow key={tab.id} tab={tab} bg="rgba(248,113,113,0.08)" />
                ))}
              </ul>
            </section>
          )}

          {diffResult && diffResult.unchanged.length > 0 && (
            <section>
              <p className="text-xs font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                = Unchanged ({diffResult.unchanged.length})
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {diffResult.unchanged.map((tab) => (
                  <TabRow key={tab.id} tab={tab} bg="rgba(255,255,255,0.04)" />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
