import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const styles = {
  success: 'border-success text-success',
  error: 'border-error text-error',
  info: 'border-primary text-primary',
  warning: 'border-warning text-warning',
};

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export default function Toast({ toast, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);
  const Icon = icons[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div
      className={`
        flex items-center gap-2 px-3 py-2 rounded-card border-l-4
        bg-[var(--color-bg)] shadow-card text-sm
        transition-all duration-200
        ${styles[toast.type]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      role="alert"
    >
      <Icon size={16} className="shrink-0" />
      <span className="flex-1 text-[var(--color-text)]">{toast.message}</span>
      {toast.action && (
        <button
          onClick={toast.action.onClick}
          className="font-medium text-primary hover:underline text-xs"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
