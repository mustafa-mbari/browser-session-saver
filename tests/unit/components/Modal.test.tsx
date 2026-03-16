import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@shared/components/Modal';

// jsdom does not implement the native <dialog> API — stub showModal/close so the
// dialog gets the `open` attribute, which makes its content accessible in tests
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  });
});

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows title and children when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="My Dialog">
        <p>Hello world</p>
      </Modal>,
    );
    expect(screen.getByText('My Dialog')).toBeInTheDocument();
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('shows a close button when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="T">
        <p>b</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="T">
        <p>b</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed while open', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose} title="T">
        <p>b</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape when the modal is closed', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={false} onClose={onClose} title="T">
        <p>b</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders the actions slot when provided', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="T" actions={<button>Confirm</button>}>
        <p>body</p>
      </Modal>,
    );
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls showModal on the dialog element when opened', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="T">
        <p>b</p>
      </Modal>,
    );
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });
});
