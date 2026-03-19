import { useState, useEffect } from 'react';
import Modal from '@shared/components/Modal';
import Button from '@shared/components/Button';
import type { QuickLink } from '@core/types/newtab.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; url: string }) => void;
  editLink?: QuickLink | null;
}

export default function AddQuickLinkModal({ isOpen, onClose, onSave, editLink }: Props) {
  const [url, setUrl] = useState(editLink?.url ?? '');
  const [title, setTitle] = useState(editLink?.title ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    setUrl(editLink?.url ?? '');
    setTitle(editLink?.title ?? '');
    setError('');
  }, [editLink, isOpen]);

  const validate = (): boolean => {
    try {
      new URL(url.includes('://') ? url : `https://${url}`);
      return true;
    } catch (_) {
      setError('Please enter a valid URL');
      return false;
    }
  };

  const handleSave = () => {
    if (!validate()) return;
    const finalUrl = url.includes('://') ? url : `https://${url}`;
    onSave({ title: title.trim() || finalUrl, url: finalUrl });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editLink ? 'Edit Quick Link' : 'Add Quick Link'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">URL</label>
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            placeholder="https://example.com"
            className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            autoFocus
          />
          {error && <p className="text-xs text-error mt-1">{error}</p>}
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="My Link"
            className="w-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>
    </Modal>
  );
}
