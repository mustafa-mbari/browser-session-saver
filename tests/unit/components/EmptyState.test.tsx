import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmptyState from '@shared/components/EmptyState';
import Button from '@shared/components/Button';
import { Inbox } from 'lucide-react';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No sessions yet"
        description="Save your first session to get started."
      />,
    );

    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    expect(screen.getByText('Save your first session to get started.')).toBeInTheDocument();
  });

  it('renders an SVG icon', () => {
    const { container } = render(
      <EmptyState icon={Inbox} title="Empty" description="Nothing here." />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders optional action when provided and fires its onClick', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Inbox}
        title="Empty"
        description="No items."
        action={<Button onClick={onClick}>Add Item</Button>}
      />,
    );

    const btn = screen.getByRole('button', { name: 'Add Item' });
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders no button when action is not provided', () => {
    render(<EmptyState icon={Inbox} title="Empty" description="Nothing." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('title is rendered as an h3', () => {
    render(<EmptyState icon={Inbox} title="My Title" description="desc" />);
    expect(screen.getByRole('heading', { level: 3, name: 'My Title' })).toBeInTheDocument();
  });
});
