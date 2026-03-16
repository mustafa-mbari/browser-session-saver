import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '@shared/components/ErrorBoundary';

// Suppress React's own console.error output when an error boundary catches
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
afterEach(() => consoleError.mockClear());

// A helper that conditionally throws
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Explosion!');
  return <span>Safe content</span>;
}

describe('ErrorBoundary', () => {
  it('renders children normally when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('shows default fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Explosion!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('shows a custom fallback node when one is provided', () => {
    render(
      <ErrorBoundary fallback={<p>Custom error UI</p>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('"Try again" resets the boundary and attempts to re-render children', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Reset — Bomb still throws, so the fallback should reappear
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows the thrown error message in the fallback', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Explosion!')).toBeInTheDocument();
  });
});
