import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppPageHeader } from './AppPageHeader';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserChannel, type UseUserChannelOptions } from '@/hooks/useUserChannel';
import { toast } from 'sonner';
import type { User } from '@/types';
import type { UserCredits, UserNotification } from '@/types/notifications';

// --- Boundary mocks -----------------------------------------------------
// This component is wiring-heavy (Inertia page props, two hooks, several
// child components). We mock the boundaries and test AppPageHeader's own
// logic: what it renders/gates, and how it wires hook callbacks together.

let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
    // Simple passthrough so we can assert on href/method/children without
    // Inertia's real Link (which needs a router context we don't have here).
    Link: ({ href, children, method, as, ...rest }: {
        href: string;
        children?: React.ReactNode;
        method?: string;
        as?: string;
        [key: string]: unknown;
    }) => (
        <a href={href} data-method={method} data-as={as} {...rest}>
            {children}
        </a>
    ),
}));

vi.mock('sonner', () => ({ toast: vi.fn() }));

vi.mock('@/hooks/useNotifications', () => ({
    useNotifications: vi.fn(),
}));

vi.mock('@/hooks/useUserChannel', () => ({
    useUserChannel: vi.fn(),
}));

// Mocked to simple markers so we can assert on the props AppPageHeader feeds
// them without depending on their (unrelated) internals or providers.
vi.mock('@/components/Header/GlobalCredits', () => ({
    GlobalCredits: (props: UserCredits) => (
        <div
            data-testid="global-credits"
            data-remaining={props.remaining}
            data-monthly-limit={props.monthlyLimit}
            data-unlimited={String(props.isUnlimited)}
            data-using-own-key={String(props.usingOwnKey)}
        />
    ),
}));

vi.mock('@/components/Notifications/NotificationBell', () => ({
    NotificationBell: (props: {
        notifications: UserNotification[];
        unreadCount: number;
        isLoading: boolean;
        onMarkAsRead: (id: number) => void;
        onMarkAllAsRead: () => void;
    }) => (
        <div
            data-testid="notification-bell"
            data-unread-count={props.unreadCount}
            data-is-loading={String(props.isLoading)}
            data-notification-count={props.notifications.length}
        />
    ),
}));

vi.mock('@/components/ThemeToggle', () => ({
    ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock('@/components/LanguageSelector', () => ({
    LanguageSelector: () => <div data-testid="language-selector" />,
}));

vi.mock('@/components/ui/sidebar', () => ({
    SidebarTrigger: () => <button data-testid="sidebar-trigger" />,
}));

// Radix's Avatar only mounts <img> once the browser reports the image
// loaded, which never happens in jsdom. Mock to a plain passthrough so the
// src wiring is directly assertable.
vi.mock('@/components/ui/avatar', () => ({
    Avatar: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="avatar">{children}</div>
    ),
    AvatarImage: ({ src }: { src?: string }) => (
        <img data-testid="avatar-image" data-src={src ?? ''} alt="" />
    ),
    AvatarFallback: ({ children }: { children?: React.ReactNode }) => (
        <span data-testid="avatar-fallback">{children}</span>
    ),
}));

// Radix's DropdownMenu only mounts its content (via a portal) once opened,
// which pulls in pointer-capture APIs jsdom doesn't implement. Since the
// gating/content logic belongs to AppPageHeader (not Radix), mock the
// primitives to always render so we can assert on the rendered content directly.
vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <button {...rest}>{children}</button>
    ),
    DropdownMenuContent: ({ children, ...rest }: { children?: React.ReactNode; [key: string]: unknown }) => (
        <div data-testid="dropdown-content" {...rest}>{children}</div>
    ),
    DropdownMenuItem: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    DropdownMenuSeparator: () => <hr />,
}));

const baseUser: User = {
    id: 7,
    name: 'alice',
    email: 'alice@example.com',
    avatar: null,
    role: 'user',
};

const baseCredits: UserCredits = {
    remaining: 10,
    monthlyLimit: 100,
    isUnlimited: false,
    usingOwnKey: false,
};

function setPageProps(overrides: Record<string, unknown> = {}) {
    pageProps = {
        broadcastConfig: { provider: 'pusher', key: 'test-key', cluster: 'mt1' },
        userCredits: baseCredits,
        unreadNotificationCount: 0,
        ...overrides,
    };
}

let addNotification: ReturnType<typeof vi.fn>;
let markAsRead: ReturnType<typeof vi.fn>;
let markAllAsRead: ReturnType<typeof vi.fn>;

describe('AppPageHeader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setPageProps();

        addNotification = vi.fn();
        markAsRead = vi.fn();
        markAllAsRead = vi.fn();

        vi.mocked(useNotifications).mockReturnValue({
            notifications: [],
            unreadCount: 0,
            isLoading: false,
            error: null,
            addNotification,
            markAsRead,
            markAllAsRead,
            refetch: vi.fn(),
        });

        vi.mocked(useUserChannel).mockReturnValue({ isConnected: false, error: null });
    });

    function lastUserChannelOptions(): UseUserChannelOptions {
        const calls = vi.mocked(useUserChannel).mock.calls;
        return calls[calls.length - 1][0];
    }

    it('renders the user name and email in both the trigger and dropdown content', () => {
        render(<AppPageHeader user={baseUser} />);

        expect(screen.getAllByText('alice')).toHaveLength(2);
        expect(screen.getAllByText('alice@example.com')).toHaveLength(2);
    });

    it('shows the uppercased first letter of the user name as the avatar fallback', () => {
        render(<AppPageHeader user={baseUser} />);

        expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('A');
    });

    it('passes the avatar URL to AvatarImage when set, and still renders the fallback', () => {
        render(<AppPageHeader user={{ ...baseUser, avatar: 'https://example.com/a.png' }} />);

        expect(screen.getByTestId('avatar-image')).toHaveAttribute('data-src', 'https://example.com/a.png');
        expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('A');
    });

    it('renders an empty AvatarImage src and still shows the fallback when avatar is null', () => {
        render(<AppPageHeader user={baseUser} />);

        expect(screen.getByTestId('avatar-image')).toHaveAttribute('data-src', '');
        expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('A');
    });

    it('applies the translucent border/background classes by default', () => {
        render(<AppPageHeader user={baseUser} />);

        const header = screen.getByRole('banner');
        expect(header.className).toContain('border-b');
        expect(header.className).toContain('bg-background/80');
    });

    it('omits the border/background classes for the transparent variant', () => {
        render(<AppPageHeader user={baseUser} variant="transparent" />);

        const header = screen.getByRole('banner');
        expect(header.className).not.toContain('border-b');
        expect(header.className).not.toContain('bg-background/80');
    });

    it('renders GlobalCredits when userCredits is present in page props', () => {
        setPageProps({ userCredits: baseCredits });
        render(<AppPageHeader user={baseUser} />);

        const marker = screen.getByTestId('global-credits');
        expect(marker).toHaveAttribute('data-remaining', String(baseCredits.remaining));
        expect(marker).toHaveAttribute('data-monthly-limit', String(baseCredits.monthlyLimit));
    });

    it('does not render GlobalCredits when userCredits is null', () => {
        setPageProps({ userCredits: null });
        render(<AppPageHeader user={baseUser} />);

        expect(screen.queryByTestId('global-credits')).not.toBeInTheDocument();
    });

    it('wraps each fixed-size header control in a shrink-0 container so credits can truncate instead', () => {
        render(<AppPageHeader user={baseUser} />);

        expect(screen.getByTestId('sidebar-trigger').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByTestId('language-selector').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByTestId('notification-bell').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByTestId('theme-toggle').closest('.shrink-0')).not.toBeNull();
        expect(screen.getByText('Log Out').closest('.shrink-0')).not.toBeNull();
    });

    it('renders a Log Out link posting to /logout', () => {
        render(<AppPageHeader user={baseUser} />);

        const logoutLink = screen.getByText('Log Out').closest('a');
        expect(logoutLink).toHaveAttribute('href', '/logout');
        expect(logoutLink).toHaveAttribute('data-method', 'post');
    });

    it('passes NotificationBell the notifications state and mark callbacks', () => {
        const notifications: UserNotification[] = [
            {
                id: 1,
                type: 'credits_low',
                title: 'Credits Running Low',
                message: 'You have less than 20% of your monthly credits remaining.',
                data: null,
                action_url: '/billing',
                read_at: null,
                created_at: new Date().toISOString(),
            },
        ];
        vi.mocked(useNotifications).mockReturnValue({
            notifications,
            unreadCount: 3,
            isLoading: true,
            error: null,
            addNotification,
            markAsRead,
            markAllAsRead,
            refetch: vi.fn(),
        });

        render(<AppPageHeader user={baseUser} />);

        const bell = screen.getByTestId('notification-bell');
        expect(bell).toHaveAttribute('data-unread-count', '3');
        expect(bell).toHaveAttribute('data-is-loading', 'true');
        expect(bell).toHaveAttribute('data-notification-count', '1');
    });

    describe('useUserChannel wiring', () => {
        it('subscribes with the user id and enabled=true when broadcastConfig has a key', () => {
            setPageProps({ broadcastConfig: { provider: 'pusher', key: 'has-a-key', cluster: 'mt1' } });
            render(<AppPageHeader user={baseUser} />);

            const options = lastUserChannelOptions();
            expect(options.userId).toBe(baseUser.id);
            expect(options.enabled).toBe(true);
        });

        it('passes enabled=false when broadcastConfig is null', () => {
            setPageProps({ broadcastConfig: null });
            render(<AppPageHeader user={baseUser} />);

            const options = lastUserChannelOptions();
            expect(options.enabled).toBe(false);
        });

        it('forwards onProjectStatus verbatim to useUserChannel', () => {
            const onProjectStatus = vi.fn();
            render(<AppPageHeader user={baseUser} onProjectStatus={onProjectStatus} />);

            const options = lastUserChannelOptions();
            expect(options.onProjectStatus).toBe(onProjectStatus);
        });

        it('onNotification adds the notification and toasts only for credits_low', () => {
            render(<AppPageHeader user={baseUser} />);

            const options = lastUserChannelOptions();
            const creditsLowNotification: UserNotification = {
                id: 1,
                type: 'credits_low',
                title: 'Credits Running Low',
                message: 'You have less than 20% of your monthly credits remaining.',
                data: null,
                action_url: '/billing',
                read_at: null,
                created_at: new Date().toISOString(),
            };

            act(() => {
                options.onNotification?.(creditsLowNotification);
            });

            expect(addNotification).toHaveBeenCalledWith(creditsLowNotification);
            expect(vi.mocked(toast)).toHaveBeenCalledWith(
                creditsLowNotification.title,
                { description: creditsLowNotification.message },
            );
        });

        it('onNotification does not toast for non-credits_low types', () => {
            render(<AppPageHeader user={baseUser} />);

            const options = lastUserChannelOptions();
            const buildCompleteNotification: UserNotification = {
                id: 2,
                type: 'build_complete',
                title: 'Build Complete',
                message: 'Your project finished building.',
                data: null,
                action_url: null,
                read_at: null,
                created_at: new Date().toISOString(),
            };

            act(() => {
                options.onNotification?.(buildCompleteNotification);
            });

            expect(addNotification).toHaveBeenCalledWith(buildCompleteNotification);
            expect(vi.mocked(toast)).not.toHaveBeenCalled();
        });

        it('onCreditsUpdated updates the GlobalCredits marker with the new values', () => {
            render(<AppPageHeader user={baseUser} />);

            const options = lastUserChannelOptions();
            act(() => {
                options.onCreditsUpdated?.({
                    remaining: 42,
                    monthlyLimit: 500,
                    isUnlimited: false,
                    usingOwnKey: true,
                });
            });

            const marker = screen.getByTestId('global-credits');
            expect(marker).toHaveAttribute('data-remaining', '42');
            expect(marker).toHaveAttribute('data-monthly-limit', '500');
            expect(marker).toHaveAttribute('data-using-own-key', 'true');
        });
    });
});
