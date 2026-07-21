import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import axios from 'axios';

// Radix AlertDialog needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('axios', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
vi.mock('@inertiajs/react', async () => ({
  ...(await vi.importActual<typeof import('@inertiajs/react')>('@inertiajs/react')),
  Head: () => null,
}));
vi.mock('@/components/Sidebar/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/Header/AppPageHeader', () => ({ AppPageHeader: () => null }));
// A stable `t` reference (unlike a fresh inline arrow per render) avoids re-triggering
// the page's `useCallback(loadConnections, [t])` effect on every render.
const { t } = vi.hoisted(() => ({ t: (s: string) => s }));
vi.mock('@/contexts/LanguageContext', () => ({
  useTranslation: () => ({ t, isRtl: false, locale: 'en' }),
}));

import Index from './Index';
import type { User } from '@/types';

const auth = { user: { id: 1, name: 'A', email: 'a@b.c' } as User };

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

describe('Databases/Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an empty state and no table when there are zero connections', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    render(<Index auth={auth} />);

    expect(await screen.findByText('No database connections yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('the empty-state CTA opens the add-connection dialog', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    render(<Index auth={auth} />);

    await screen.findByText('No database connections yet');
    const buttons = screen.getAllByRole('button', { name: 'Add Connection' });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText("Enter your Supabase project's connection details below.")).toBeInTheDocument();
  });

  it('renders the table and no empty state when connections exist', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          label: 'Prod',
          url: 'https://xxxx.supabase.co',
          publishable_key: 'sb_publishable_x',
          has_secret_key: true,
          has_db_connection: true,
          last_tested_at: null,
        },
      ],
    });
    render(<Index auth={auth} />);

    expect(await screen.findByText('Prod')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No database connections yet')).not.toBeInTheDocument();
  });

  it('deleting a connection opens an AlertDialog confirm (not window.confirm), and confirming deletes it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          label: 'Prod',
          url: 'https://xxxx.supabase.co',
          publishable_key: 'sb_publishable_x',
          has_secret_key: true,
          has_db_connection: true,
          last_tested_at: null,
        },
      ],
    });
    mockedAxios.delete.mockResolvedValue({ data: {} });
    render(<Index auth={auth} />);

    await screen.findByText('Prod');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(mockedAxios.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
    });
  });
});
