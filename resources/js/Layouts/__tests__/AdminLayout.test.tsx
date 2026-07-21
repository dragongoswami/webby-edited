import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminLayout from '../AdminLayout';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserChannel } from '@/hooks/useUserChannel';
import type { User } from '@/types';
import type { UserCredits } from '@/types/notifications';

// --- Boundary mocks -----------------------------------------------------
// AdminLayout is wiring-heavy (Inertia page props, sidebar provider, two
// hooks, several child components). We mock the boundaries and assert on
// AdminLayout's own header markup (the shrink-0 wrappers under test).

let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    Head: () => null,
    Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode; [key: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

vi.mock('sonner', () => ({ toast: vi.fn() }));

vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/components/ui/tooltip', () => ({
    TooltipProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/sidebar', () => ({
    SidebarProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SidebarInset: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SidebarTrigger: () => <button data-testid="sidebar-trigger" />,
}));

vi.mock('@/components/Sidebar/AppSidebar', () => ({
    AppSidebar: () => <div data-testid="app-sidebar" />,
}));

vi.mock('@/hooks/useNotifications', () => ({ useNotifications: vi.fn() }));
vi.mock('@/hooks/useUserChannel', () => ({ useUserChannel: vi.fn() }));

vi.mock('@/components/Header/GlobalCredits', () => ({
    GlobalCredits: () => <div data-testid="global-credits" />,
}));

vi.mock('@/components/Notifications/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/components/ThemeToggle', () => ({
    ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/components/LanguageSelector', () => ({
    LanguageSelector: () => <div data-testid="language-selector" />,
}));

vi.mock('@/Layouts/AdminDemoBanner', () => ({
    AdminDemoBanner: () => null,
}));

vi.mock('@/components/DemoResetNotice', () => ({
    DemoResetNotice: () => null,
}));

vi.mock('@/components/ui/avatar', () => ({
    Avatar: ({ children }: { children?: React.ReactNode }) => <div data-testid="avatar">{children}</div>,
    AvatarImage: () => <img data-testid="avatar-image" alt="" />,
    AvatarFallback: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <button {...rest}>{children}</button>
    ),
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    DropdownMenuSeparator: () => <hr />,
}));

const baseUser: User = {
    id: 7,
    name: 'alice',
    email: 'alice@example.com',
    avatar: null,
    role: 'admin',
};

const baseCredits: UserCredits = {
    remaining: 10,
    monthlyLimit: 100,
    isUnlimited: false,
    usingOwnKey: false,
};

describe('AdminLayout', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        pageProps = {
            broadcastConfig: { provider: 'pusher', key: 'test-key', cluster: 'mt1' },
            userCredits: baseCredits,
            unreadNotificationCount: 0,
        };

        vi.mocked(useNotifications).mockReturnValue({
            notifications: [],
            unreadCount: 0,
            isLoading: false,
            error: null,
            addNotification: vi.fn(),
            markAsRead: vi.fn(),
            markAllAsRead: vi.fn(),
            refetch: vi.fn(),
        });

        vi.mocked(useUserChannel).mockReturnValue({ isConnected: false, error: null });
    });

    it('wraps each fixed-size header control in a shrink-0 container so credits can truncate instead', () => {
        render(
            <AdminLayout user={baseUser} title="Users">
                <div>content</div>
            </AdminLayout>
        );

        expect(screen.getByTestId('sidebar-trigger').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByTestId('language-selector').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByTestId('notification-bell').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByTestId('theme-toggle').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByText('Log Out').closest('.shrink-0')).not.toBeNull();
    });

    it('still renders the page content', () => {
        render(
            <AdminLayout user={baseUser} title="Users">
                <div>page content</div>
            </AdminLayout>
        );

        expect(screen.getByText('page content')).toBeInTheDocument();
    });
});
