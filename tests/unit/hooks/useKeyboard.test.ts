import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useKeyboard } from '@shared/hooks/useKeyboard';

describe('useKeyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fires action on matching Ctrl+Shift+P combo', () => {
    const action = vi.fn();
    renderHook(() => useKeyboard({ 'Ctrl+Shift+P': action }));

    fireEvent.keyDown(document, { key: 'p', ctrlKey: true, shiftKey: true });

    expect(action).toHaveBeenCalledOnce();
  });

  it('calls preventDefault when a combo matches', () => {
    const action = vi.fn();
    renderHook(() => useKeyboard({ 'Ctrl+S': action }));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
  });

  it('does not fire action on non-matching combo', () => {
    const action = vi.fn();
    renderHook(() => useKeyboard({ 'Ctrl+Shift+P': action }));

    fireEvent.keyDown(document, { key: 'x', ctrlKey: true, shiftKey: true });

    expect(action).not.toHaveBeenCalled();
  });

  it('uses uppercase key in combo string (Enter → ENTER)', () => {
    const action = vi.fn();
    renderHook(() => useKeyboard({ 'Ctrl+ENTER': action }));

    fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });

    expect(action).toHaveBeenCalledOnce();
  });

  it('removes event listener on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboard({ 'Ctrl+A': vi.fn() }));

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('supports multiple shortcuts in one call', () => {
    const actionA = vi.fn();
    const actionB = vi.fn();
    renderHook(() => useKeyboard({ 'Ctrl+A': actionA, 'Ctrl+B': actionB }));

    fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(document, { key: 'b', ctrlKey: true });

    expect(actionA).toHaveBeenCalledOnce();
    expect(actionB).toHaveBeenCalledOnce();
  });
});
