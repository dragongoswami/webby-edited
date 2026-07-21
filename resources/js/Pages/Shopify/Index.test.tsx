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

describe('Shopify/Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an empty state and no table when there are zero connections', async () => {
    mockedAxios.get.mockResolvedValue({ data: [] });
    render(<Index auth={auth} />);

    expect(await screen.findByText('No Shopify stores connected yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the table, no empty state, and a destructive badge for a revoked connection', async () => {
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          label: 'My Store',
          shop_domain: 'mystore.myshopify.com',
          status: 'revoked',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
    render(<Index auth={auth} />);

    expect(await screen.findByText('mystore.myshopify.com')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No Shopify stores connected yet')).not.toBeInTheDocument();

    const badge = screen.getByText('Revoked');
    expect(badge.className).toContain('destructive');
  });

  it('removing a store connection opens an AlertDialog confirm (not window.confirm), and confirming deletes it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mockedAxios.get.mockResolvedValue({
      data: [
        {
          id: 1,
          label: 'My Store',
          shop_domain: 'mystore.myshopify.com',
          status: 'active',
          last_used_at: null,
          created_at: '2024-01-01T00:00:00Z',
        },
      ],
    });
    mockedAxios.delete.mockResolvedValue({ data: {} });
    render(<Index auth={auth} />);

    await screen.findByText('mystore.myshopify.com');
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
