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
// The layout shell (sidebar + header) pulls in theme/page-prop providers that
// aren't relevant to this page's own behaviour — stub them out, like other
// page tests stub their layout wrappers.
vi.mock('@/components/Sidebar/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/Header/AppPageHeader', () => ({ AppPageHeader: () => null }));
// The page calls useTranslation(); stub it so t() echoes its key (like other page tests).
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

describe('Github/Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the connect action', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    render(<Index auth={auth} />);
    expect(await screen.findByRole('button', { name: /connect github/i })).toBeInTheDocument();
  });

  it('renders an empty state and no table when there are zero connections', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    render(<Index auth={auth} />);

    expect(await screen.findByText('No GitHub connections yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the table, no empty state, and a destructive badge for a revoked connection', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          label: 'Personal',
          github_login: 'octocat',
          account_type: 'User',
          status: 'revoked',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
    render(<Index auth={auth} />);

    expect(await screen.findByText('octocat')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No GitHub connections yet')).not.toBeInTheDocument();

    const badge = screen.getByText('Revoked');
    expect(badge.className).toContain('destructive');
  });

  it('removing a connection opens an AlertDialog confirm (not window.confirm), and confirming deletes it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          label: 'Personal',
          github_login: 'octocat',
          account_type: 'User',
          status: 'active',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
    mockedAxios.delete.mockResolvedValue({ data: {} });
    render(<Index auth={auth} />);

    await screen.findByText('octocat');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(mockedAxios.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
    });
  });
});
