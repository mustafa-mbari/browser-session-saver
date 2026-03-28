import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toast from '@shared/components/Toast';
import type { ToastData } from '@shared/components/Toast';

function makeToast(overrides: Partial<ToastData> = {}): ToastData {
  return {
    id: 'toast-1',
    message: 'Operation successful',
    type: 'success',
    ...overrides,
  };
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the toast message', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<Toast toast={makeToast()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onDismiss immediately when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ id: 'toast-abc' })} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onDismiss).toHaveBeenCalledWith('toast-abc');
  });

  it('calls onDismiss automatically after the default 4 s duration + 200 ms fade', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ id: 't1' })} onDismiss={onDismiss} />);

    // Before 4200 ms — not yet dismissed
    vi.advanceTimersByTime(4199);
    expect(onDismiss).not.toHaveBeenCalled();

    // After 4000 ms (fade start) + 200 ms (dismiss delay)
    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('respects a custom duration', () => {
    const onDismiss = vi.fn();
    render(<Toast toast={makeToast({ id: 't2', duration: 1000 })} onDismiss={onDismiss} />);

    vi.advanceTimersByTime(1199);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1); // 1000 + 200 ms
    expect(onDismiss).toHaveBeenCalledWith('t2');
  });

  it('renders optional action button and fires its onClick', () => {
    const actionClick = vi.fn();
    render(
      <Toast
        toast={makeToast({ action: { label: 'Undo', onClick: actionClick } })}
        onDismiss={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(actionClick).toHaveBeenCalledOnce();
  });

  it('applies error border class for error type', () => {
    render(<Toast toast={makeToast({ type: 'error' })} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert').className).toContain('border-error');
  });

  it('applies warning border class for warning type', () => {
    render(<Toast toast={makeToast({ type: 'warning' })} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert').className).toContain('border-warning');
  });
});
