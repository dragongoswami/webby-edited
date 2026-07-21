import { act } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Chat from '../Chat';
import type { CompleteEvent } from '@/hooks/useBuilderChat';

// --- Boundary mocks -------------------------------------------------------
// Chat.tsx is wiring-heavy (Inertia page props, several real-time hooks, and
// a dozen heavy child components). We mock the boundaries and assert on
// Chat's own mobile-pane gating (chat column / right column visibility,
// the tab bar, and the build-complete pulse dot).

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: { flash: {}, unreadNotificationCount: 0, canConnectShopify: false } }),
    Head: () => null,
    Link: ({ href, children, ...rest }: { href: string; children?: React.ReactNode; [key: string]: unknown }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: {} }),
        post: vi.fn().mockResolvedValue({ data: {} }),
        put: vi.fn().mockResolvedValue({ data: {} }),
        patch: vi.fn().mockResolvedValue({ data: {} }),
        isAxiosError: () => false,
    },
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
    Toaster: () => null,
}));

vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));

type BuilderChatOptions = { onComplete?: (event: CompleteEvent) => void };
const builderChatState: { options: BuilderChatOptions | null } = { options: null };

vi.mock('@/hooks/useBuilderChat', () => ({
    useBuilderChat: (_projectId: string, options: BuilderChatOptions) => {
        builderChatState.options = options;
        return {
            messages: [],
            progress: { status: 'idle', actions: [], previewUrl: 'https://preview.example.com', error: null },
            isLoading: false,
            sendMessage: vi.fn(),
            cancelBuild: vi.fn(),
            triggerBuild: vi.fn(),
            isBuildingPreview: false,
        };
    },
}));

vi.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        addNotification: vi.fn(),
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
    }),
}));

vi.mock('@/hooks/useUserChannel', () => ({
    useUserChannel: () => ({ isConnected: false, error: null }),
}));

vi.mock('@/hooks/useBuildCredits', () => ({
    useBuildCredits: (initial: unknown) => ({
        credits: initial,
        isRefreshing: false,
        update: vi.fn(),
        refresh: vi.fn(),
    }),
}));

vi.mock('@/components/Notifications/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }));
vi.mock('@/components/LanguageSelector', () => ({ LanguageSelector: () => <div data-testid="language-selector" /> }));

vi.mock('@/components/Code/FileTree', () => ({ FileTree: () => null }));
vi.mock('@/components/Code/CodeEditor', () => ({ CodeEditor: () => null }));
vi.mock('@/components/Chat/MessageBubble', () => ({ MessageBubble: () => null }));

vi.mock('@/components/Project/PublishModal', () => ({
    default: ({ open }: { open: boolean }) => (open ? <div data-testid="publish-modal" /> : null),
}));

vi.mock('@/components/Project/ProjectSettingsPanel', () => ({
    ProjectSettingsPanel: () => <div data-testid="project-settings-panel" />,
}));

vi.mock('@/components/Preview/InspectPreview', () => ({
    InspectPreview: () => <div data-testid="inspect-preview" />,
}));

vi.mock('@/components/Preview/WordPressPlaygroundPreview', () => ({
    WordPressPlaygroundPreview: () => <div data-testid="wp-preview" />,
}));

vi.mock('@/components/Preview/ShopifyThemePreview', () => ({
    ShopifyThemePreview: () => <div data-testid="shopify-preview" />,
}));

vi.mock('@/components/Chat/ChatInputWithMentions', () => ({
    ChatInputWithMentions: () => <div data-testid="chat-input" />,
}));

vi.mock('@/components/Chat/BuildCreditsIndicator', () => ({
    BuildCreditsIndicator: () => <div data-testid="build-credits" />,
}));

vi.mock('@/components/Design/DesignDesigner', () => ({
    DesignDesigner: () => <div data-testid="design-designer" />,
}));

const baseProject = {
    id: 'proj-1',
    name: 'My Project',
    initial_prompt: null,
    has_history: true,
    conversation_history: [],
    preview_url: 'https://preview.example.com',
    has_active_session: false,
    build_session_id: null,
    build_status: 'completed',
    can_reconnect: false,
    build_started_at: null,
    subdomain: null,
    published_title: null,
    published_description: null,
    published_visibility: 'public',
    published_at: null,
    custom_instructions: null,
    output_target: 'website' as const,
    design_system_id: null,
    design_accent: null,
    share_image: null,
};

const baseProps = {
    project: baseProject,
    user: { id: 1, name: 'Test User', email: 'test@example.com', avatar: null, role: 'user' },
    designSystems: [],
    pusherConfig: { provider: 'pusher', key: '', cluster: '' },
    soundSettings: { enabled: false, style: 'minimal', volume: 50 },
    baseDomain: 'example.com',
    canUseSubdomains: true,
    canCreateMoreSubdomains: true,
    canUsePrivateVisibility: true,
    canExportCode: false,
    suggestedSubdomain: 'my-project',
    subdomainUsage: { used: 0, limit: null, unlimited: true, remaining: 1 },
    storage: undefined,
    projectFiles: [],
    customDomain: undefined,
    subdomainsGloballyEnabled: true,
    customDomainsGloballyEnabled: true,
    buildCredits: { remaining: 10, monthlyLimit: 100, isUnlimited: false, usingOwnKey: false },
} as unknown as React.ComponentProps<typeof Chat>;

describe('Chat mobile pane gating', () => {
    beforeEach(() => {
        builderChatState.options = null;
        vi.stubGlobal('innerWidth', 375);
    });

    it('reserves space for the fixed impersonation banner on the h-dvh editor shell', () => {
        const { container } = render(<Chat {...baseProps} />);
        const root = container.querySelector('.h-dvh') as HTMLElement;

        expect(root).not.toBeNull();
        expect(root.className).toContain('pt-[var(--impersonation-banner-height,0px)]');
    });

    it('defaults to the chat pane: chat column visible, preview column hidden', () => {
        render(<Chat {...baseProps} />);

        const chatColumn = screen.getByTestId('chat-column');
        const previewColumn = screen.getByTestId('preview-column');

        expect(chatColumn.className).toContain('flex');
        expect(chatColumn.className).not.toMatch(/(^|\s)hidden(\s|$)/);
        expect(previewColumn.className).toMatch(/(^|\s)hidden(\s|$)/);
    });

    it('reveals the preview column (with the Publish control) after switching to the Preview tab', async () => {
        const user = userEvent.setup();
        render(<Chat {...baseProps} />);

        await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Preview' }));

        const chatColumn = screen.getByTestId('chat-column');
        const previewColumn = screen.getByTestId('preview-column');

        expect(previewColumn.className).toContain('flex');
        expect(previewColumn.className).not.toMatch(/(^|\s)hidden(\s|$)/);
        expect(chatColumn.className).toMatch(/(^|\s)hidden(\s|$)/);
        expect(screen.getByText('Publish')).toBeInTheDocument();
    });

    it('preview-header tabs and actions are icon-only on mobile (labels hidden below sm, accessible names kept)', () => {
        render(<Chat {...baseProps} />);

        const previewColumn = screen.getByTestId('preview-column');

        // View-mode tabs: label text wrapped in a hidden sm:inline span, button
        // keeps an accessible name via aria-label.
        for (const name of ['Preview', 'Code', 'Settings']) {
            const tab = within(previewColumn).getByRole('button', { name });
            const label = within(tab).getByText(name);
            expect(label.className).toContain('hidden');
            expect(label.className).toContain('sm:inline');
        }

        // Rebuild action: same treatment.
        const rebuild = within(previewColumn).getByRole('button', { name: 'Rebuild' });
        const rebuildLabel = within(rebuild).getByText('Rebuild');
        expect(rebuildLabel.className).toContain('hidden');
        expect(rebuildLabel.className).toContain('sm:inline');
    });

    it('shows a pulse dot on the Preview tab when a build completes while on the chat pane', async () => {
        render(<Chat {...baseProps} />);

        expect(screen.queryByTestId('preview-dot')).not.toBeInTheDocument();

        act(() => {
            builderChatState.options?.onComplete?.({ files_changed: false } as CompleteEvent);
        });

        expect(screen.getByTestId('preview-dot')).toBeInTheDocument();
    });

    it('does not show a pulse dot when a build completes while already on the preview pane', async () => {
        const user = userEvent.setup();
        render(<Chat {...baseProps} />);

        await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Preview' }));

        act(() => {
            builderChatState.options?.onComplete?.({ files_changed: false } as CompleteEvent);
        });

        expect(screen.queryByTestId('preview-dot')).not.toBeInTheDocument();
    });
});
