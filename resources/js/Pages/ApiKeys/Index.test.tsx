import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import axios from 'axios';

// Radix AlertDialog needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
vi.mock('@inertiajs/react', async () => ({
  ...(await vi.importActual<typeof import('@inertiajs/react')>('@inertiajs/react')),
  Head: () => null,
}));
vi.mock('@/components/Sidebar/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/Header/AppPageHeader', () => ({ AppPageHeader: () => null }));
// A stable `t` reference (unlike a fresh inline arrow per render) avoids re-triggering
// the page's `useCallback(loadKeys, [t])` effect on every render.
const { t } = vi.hoisted(() => ({ t: (s: string) => s }));
vi.mock('@/contexts/LanguageContext', () => ({
  useTranslation: () => ({ t, isRtl: false, locale: 'en' }),
}));

import Index from './Index';
import type { User } from '@/types';

const auth = { user: { id: 1, name: 'A', email: 'a@b.c' } as User };

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

describe('ApiKeys/Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders an empty state and no table when there are zero keys', async () => {
    mockedAxios.get.mockResolvedValue({ data: { keys: [] } });
    render(<Index auth={auth} />);

    expect(await screen.findByText('No API keys yet')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('the empty-state CTA opens the create-key dialog', async () => {
    mockedAxios.get.mockResolvedValue({ data: { keys: [] } });
    render(<Index auth={auth} />);

    await screen.findByText('No API keys yet');
    const buttons = screen.getAllByRole('button', { name: 'Create Key' });
    fireEvent.click(buttons[buttons.length - 1]);

    expect(await screen.findByText('Give the key a name and choose when it expires. The key grants read-only access to your account.')).toBeInTheDocument();
  });

  it('renders the table and no empty state when keys exist', async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        keys: [
          {
            id: 1,
            name: 'CI script',
            masked: 'sk_****abcd',
            created_at: '2024-01-01T00:00:00Z',
            expires_at: null,
            last_used_at: null,
          },
        ],
      },
    });
    render(<Index auth={auth} />);

    expect(await screen.findByText('CI script')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('No API keys yet')).not.toBeInTheDocument();
  });

  it('revoking a key opens an AlertDialog confirm (not window.confirm), and confirming deletes it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mockedAxios.get.mockResolvedValue({
      data: {
        keys: [
          {
            id: 1,
            name: 'CI script',
            masked: 'sk_****abcd',
            created_at: '2024-01-01T00:00:00Z',
            expires_at: null,
            last_used_at: null,
          },
        ],
      },
    });
    mockedAxios.delete.mockResolvedValue({ data: {} });
    render(<Index auth={auth} />);

    await screen.findByText('CI script');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Revoke' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog');
    expect(mockedAxios.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledTimes(1);
    });
  });
});
