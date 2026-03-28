import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import ContextMenu from '@shared/components/ContextMenu';

const defaultItems = [
  { label: 'Edit', onClick: vi.fn() },
  { label: 'Duplicate', onClick: vi.fn() },
  { label: 'Delete', onClick: vi.fn(), danger: true },
];

function renderMenu(items = defaultItems) {
  return render(
    <ContextMenu items={items}>
      <button>Open menu</button>
    </ContextMenu>,
  );
}

describe('ContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render menu items before trigger is clicked', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens menu on trigger click and shows all item labels', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));

    // Use waitFor because focus is deferred via requestAnimationFrame
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('calls item onClick and closes menu when a menu item is clicked', async () => {
    const editFn = vi.fn();
    render(
      <ContextMenu items={[{ label: 'Edit', onClick: editFn }, { label: 'Other', onClick: vi.fn() }]}>
        <button>Open menu</button>
      </ContextMenu>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(editFn).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes menu when clicking outside both trigger and menu', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('closes menu on Escape key from the menu', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('navigates items with ArrowDown and ArrowUp without crashing', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('Home and End keys navigate to first and last items without crashing', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'End' });
    fireEvent.keyDown(menu, { key: 'Home' });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('Tab key closes the menu', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('clicking trigger while open toggles it closed', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument());

    // Second click closes
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
