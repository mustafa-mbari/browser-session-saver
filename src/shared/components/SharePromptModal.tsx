import { useState, useEffect } from 'react';
import { X, Copy, Check, ExternalLink, Share2 } from 'lucide-react';
import type { Prompt } from '@core/types/prompt.types';

interface Props {
  prompt: Prompt;
  onClose: () => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'success'; url: string }
  | { kind: 'error'; message: string };

const SITE_URL = import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000';

export default function SharePromptModal({ prompt, onClose }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${SITE_URL}/api/prompts/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: prompt.title,
        content: prompt.content,
        description: prompt.description ?? null,
        tags: prompt.tags,
        compatibleModels: prompt.compatibleModels ?? [],
      }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { url: string }) => {
        setState({ kind: 'success', url: data.url });
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        console.error('[SharePromptModal]', err);
        setState({ kind: 'error', message: 'Could not create share link. Please try again.' });
      });

    return () => controller.abort();
  }, [prompt]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCopy = async () => {
    if (state.kind !== 'success') return;
    await navigator.clipboard.writeText(state.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInBrowser = () => {
    if (state.kind !== 'success') return;
    chrome.tabs.create({ url: state.url });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-xl shadow-2xl p-5"
        style={{
          background: 'var(--color-bg)',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-amber-500" />
            <h2 className="text-base font-semibold">Share Prompt</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Prompt title preview */}
        <p
          className="text-xs mb-4 truncate"
          style={{ color: 'var(--color-text-secondary, #6b7280)' }}
        >
          {prompt.title}
        </p>

        {/* State-dependent body */}
        {state.kind === 'loading' && (
          <div className="flex items-center justify-center py-6 gap-2">
            <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
              Creating share link…
            </span>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="py-4 text-center">
            <p className="text-sm text-red-500 mb-3">{state.message}</p>
            <button
              onClick={() => setState({ kind: 'loading' })}
              className="text-sm text-amber-500 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {state.kind === 'success' && (
          <>
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 mb-4"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <input
                readOnly
                value={state.url}
                className="flex-1 text-xs bg-transparent outline-none min-w-0"
                style={{ color: 'var(--color-text)' }}
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors bg-amber-500 text-white hover:bg-amber-600"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleOpenInBrowser}
                title="Open in browser"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-opacity hover:opacity-70"
                style={{
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <ExternalLink size={14} />
              </button>
            </div>

            <p
              className="text-xs mt-3 text-center"
              style={{ color: 'var(--color-text-secondary, #9ca3af)' }}
            >
              Anyone with this link can view this prompt — no login required.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
