import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@shared/components/Button';
import { Search } from 'lucide-react';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and does not fire onClick when disabled prop is set', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Submit</Button>);

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();

    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows spinner and is disabled when loading=true', () => {
    render(<Button loading>Loading</Button>);

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders icon SVG when icon prop is provided', () => {
    render(<Button icon={Search}>Search</Button>);
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument();
  });

  it('applies w-full class when fullWidth=true', () => {
    render(<Button fullWidth>Full</Button>);
    expect(screen.getByRole('button').className).toContain('w-full');
  });

  it('forwards extra HTML attributes (aria-label)', () => {
    render(<Button aria-label="close dialog">×</Button>);
    expect(screen.getByRole('button', { name: 'close dialog' })).toBeInTheDocument();
  });

  it('applies danger variant bg class', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button').className).toContain('bg-error');
  });

  it('applies ghost variant hover class', () => {
    render(<Button variant="ghost">Cancel</Button>);
    expect(screen.getByRole('button').className).toContain('hover:bg-gray-100');
  });
});
