import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '@shared/components/Badge';

describe('Badge', () => {
  it('renders children text', () => {
    render(<Badge>New</Badge>);
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('defaults to the default variant', () => {
    render(<Badge>Tag</Badge>);
    expect(screen.getByText('Tag').className).toContain('bg-gray-100');
  });

  it('applies primary variant styles', () => {
    render(<Badge variant="primary">Primary</Badge>);
    expect(screen.getByText('Primary').className).toContain('bg-blue-50');
  });

  it('applies success variant styles', () => {
    render(<Badge variant="success">OK</Badge>);
    expect(screen.getByText('OK').className).toContain('bg-green-50');
  });

  it('applies warning variant styles', () => {
    render(<Badge variant="warning">Soon</Badge>);
    expect(screen.getByText('Soon').className).toContain('bg-yellow-50');
  });

  it('applies error variant styles', () => {
    render(<Badge variant="error">Overdue</Badge>);
    expect(screen.getByText('Overdue').className).toContain('bg-red-50');
  });

  it('merges custom className', () => {
    render(<Badge className="ml-2">Extra</Badge>);
    expect(screen.getByText('Extra').className).toContain('ml-2');
  });

  it('renders as an inline span', () => {
    const { container } = render(<Badge>Span</Badge>);
    expect(container.querySelector('span')).toBeInTheDocument();
  });
});
