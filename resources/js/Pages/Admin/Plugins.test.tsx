import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { Plugin, PluginConfigField } from '@/types/billing';

// Radix Dialog/Switch/Select need these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

// --- Mocks ---

const routerPost = vi.fn();
const routerDelete = vi.fn();

vi.mock('@inertiajs/react', () => ({
    router: {
        post: (...args: unknown[]) => routerPost(...args),
        delete: (...args: unknown[]) => routerDelete(...args),
        // usePageLoading (used internally by Plugins) subscribes to these.
        on: vi.fn(() => vi.fn()),
    },
}));

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/Layouts/AdminLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/Admin/UploadPluginModal', () => ({
    default: () => null,
}));

// The global `route()` helper is stubbed by the test setup to ignore params
// (`/${name}`), which would hide a bug where the wrong slug is passed. Replace
// it here with a spy that embeds the param so we can assert on the real URL.
const routeSpy = vi.fn((name: string, param?: string | number) =>
    param !== undefined ? `/${name}/${param}` : `/${name}`
);
(globalThis as unknown as { route: typeof routeSpy }).route = routeSpy;

import Plugins from './Plugins';

function makeField(overrides: Partial<PluginConfigField> = {}): PluginConfigField {
    return {
        name: 'field',
        label: 'Field',
        type: 'text',
        ...overrides,
    };
}

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
    return {
        id: 1,
        slug: 'plugin-slug',
        name: 'Plugin Name',
        description: 'Plugin description text',
        type: 'builder_capability',
        version: '1.0.0',
        author: 'Webby',
        icon: null,
        is_installed: false,
        is_active: false,
        is_configured: false,
        is_core: false,
        config_schema: [],
        config: {},
        ...overrides,
    };
}

const paypal = makePlugin({
    id: 1,
    slug: 'paypal',
    name: 'PayPal',
    description: 'Accept payments via PayPal',
    type: 'payment_gateway',
    icon: 'CreditCard',
    is_installed: true,
    is_active: true,
    is_configured: true,
    is_core: true,
    config_schema: [
        makeField({ name: 'client_id', label: 'Client ID', type: 'text', required: true }),
        makeField({ name: 'secret', label: 'Client Secret', type: 'password', required: true }),
    ],
    config: { client_id: 'abc', secret: 'shh' },
});

const webAgent = makePlugin({
    id: 2,
    slug: 'web-agent',
    name: 'Web Agent',
    description: 'AI-powered web building agent',
    type: 'builder_capability',
    is_installed: false,
    is_active: false,
    is_configured: false,
    is_core: false,
    config_schema: [],
    config: {},
});

const github = makePlugin({
    id: 3,
    slug: 'github',
    name: 'GitHub',
    description: 'Push generated code to GitHub',
    type: 'builder_capability',
    icon: 'Github',
    is_installed: true,
    is_active: false,
    is_configured: true,
    is_core: false,
    config_schema: [
        makeField({ name: 'app_id', label: 'App ID', type: 'text', required: true }),
    ],
    config: { app_id: '1234' },
});

const awsS3 = makePlugin({
    id: 4,
    slug: 'aws-s3',
    name: 'AWS S3',
    description: 'Store project files on S3',
    type: 'storage_provider',
    icon: 'HardDrive',
    is_installed: true,
    is_active: false,
    is_configured: false,
    is_core: false,
    config_schema: [
        makeField({ name: 'access_key', label: 'Access Key', type: 'text', required: true, placeholder: 'AKIA...' }),
        makeField({ name: 'secret_key', label: 'Secret Key', type: 'password', required: true }),
        makeField({ name: 'use_ssl', label: 'Use SSL', type: 'toggle' }),
        makeField({ name: 'max_retries', label: 'Max Retries', type: 'number', default: 3 }),
    ],
    config: {},
});

const autoUpdate = makePlugin({
    id: 5,
    slug: 'auto-update',
    name: 'Auto Update',
    description: 'In-app auto-updater',
    type: 'system',
    is_installed: true,
    is_active: true,
    is_configured: true,
    is_core: false,
    config_schema: [],
    config: {},
});

const auth = { user: { id: 1, name: 'Admin', email: 'admin@example.com' } };

describe('Admin/Plugins', () => {
    beforeEach(() => {
        routerPost.mockClear();
        routerDelete.mockClear();
        routeSpy.mockClear();
    });

    it('renders plugin cards grouped by category with names and descriptions', () => {
        render(<Plugins auth={auth} plugins={[paypal, webAgent, github, awsS3, autoUpdate]} />);

        expect(screen.getByText('System')).toBeInTheDocument();
        expect(screen.getByText('Builder Capabilities')).toBeInTheDocument();
        expect(screen.getByText('Storage Providers')).toBeInTheDocument();
        expect(screen.getByText('Payment Gateways')).toBeInTheDocument();

        expect(screen.getByText('PayPal')).toBeInTheDocument();
        expect(screen.getByText('Accept payments via PayPal')).toBeInTheDocument();
        expect(screen.getByText('Web Agent')).toBeInTheDocument();
        expect(screen.getByText('AWS S3')).toBeInTheDocument();
        expect(screen.getByText('Auto Update')).toBeInTheDocument();
    });

    it('shows an Install button (no toggle switch) for a not-installed plugin', () => {
        render(<Plugins auth={auth} plugins={[webAgent]} />);

        expect(screen.getByRole('button', { name: /Install/ })).toBeInTheDocument();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(screen.getByText('Not Installed')).toBeInTheDocument();
    });

    it('shows a toggle switch (no Install button) for an installed plugin', () => {
        render(<Plugins auth={auth} plugins={[github]} />);

        expect(screen.getByRole('switch')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^Install$/ })).not.toBeInTheDocument();
    });

    it('clicking Install posts to the install route with the plugin slug', () => {
        render(<Plugins auth={auth} plugins={[webAgent]} />);

        fireEvent.click(screen.getByRole('button', { name: /Install/ }));

        expect(routeSpy).toHaveBeenCalledWith('admin.plugins.install', 'web-agent');
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.plugins.install/web-agent');
        expect(data).toEqual({});
    });

    it('toggling an already-configured, inactive plugin posts to the toggle route', () => {
        render(<Plugins auth={auth} plugins={[github]} />);

        const toggle = screen.getByRole('switch');
        expect(toggle).not.toBeDisabled();

        fireEvent.click(toggle);

        expect(routeSpy).toHaveBeenCalledWith('admin.plugins.toggle', 'github');
        expect(routerPost).toHaveBeenCalledTimes(1);
        expect(routerPost.mock.calls[0][0]).toBe('/admin.plugins.toggle/github');
    });

    it('disables the toggle switch and shows "Configuration required" for an installed-but-unconfigured plugin; Configure opens the settings dialog instead', () => {
        render(<Plugins auth={auth} plugins={[awsS3]} />);

        const toggle = screen.getByRole('switch');
        expect(toggle).toBeDisabled();
        expect(screen.getByText('Configuration required')).toBeInTheDocument();

        // Clicking the disabled switch is a no-op — it never reaches handleToggle.
        fireEvent.click(toggle);
        expect(routerPost).not.toHaveBeenCalled();

        // The real gate to activation is the Configure button, which opens the dialog.
        expect(screen.queryByText('Enter your plugin configuration settings below.')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
        expect(screen.getByText('Enter your plugin configuration settings below.')).toBeInTheDocument();
    });

    it('renders config dialog fields per schema type: text, password (masked), toggle, and number (with default)', () => {
        render(<Plugins auth={auth} plugins={[awsS3]} />);

        fireEvent.click(screen.getByRole('button', { name: /Configure/ }));

        // Required-field labels append a "*" marker, so match by prefix.
        const accessKeyInput = screen.getByLabelText(/Access Key/) as HTMLInputElement;
        expect(accessKeyInput).toHaveAttribute('type', 'text');
        expect(accessKeyInput.placeholder).toBe('AKIA...');

        const secretKeyInput = screen.getByLabelText(/Secret Key/) as HTMLInputElement;
        expect(secretKeyInput).toHaveAttribute('type', 'password');

        // The password field's reveal toggle defaults to masked and can be
        // switched to plain text and back.
        fireEvent.click(screen.getByRole('button', { name: 'Show secret' }));
        expect(secretKeyInput).toHaveAttribute('type', 'text');
        fireEvent.click(screen.getByRole('button', { name: 'Hide secret' }));
        expect(secretKeyInput).toHaveAttribute('type', 'password');

        expect(screen.getByLabelText('Use SSL')).toHaveAttribute('role', 'switch');

        const maxRetriesInput = screen.getByLabelText('Max Retries') as HTMLInputElement;
        expect(maxRetriesInput).toHaveAttribute('type', 'number');
        expect(maxRetriesInput.value).toBe('3');
    });

    it('saving valid config posts values to the configure route', () => {
        render(<Plugins auth={auth} plugins={[awsS3]} />);

        fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
        fireEvent.change(screen.getByLabelText(/Access Key/), { target: { value: 'AKIA123' } });
        fireEvent.change(screen.getByLabelText(/Secret Key/), { target: { value: 'topsecret' } });

        fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.plugins.configure', 'aws-s3');
        expect(routerPost).toHaveBeenCalledTimes(1);
        const [url, data] = routerPost.mock.calls[0];
        expect(url).toBe('/admin.plugins.configure/aws-s3');
        expect(data).toEqual({
            access_key: 'AKIA123',
            secret_key: 'topsecret',
            // A toggle field with no explicit `default` initializes to '' (falsy,
            // unchecked in the UI) rather than `false` — see openConfigDialog.
            use_ssl: '',
            max_retries: 3,
        });
    });

    it('shows a validation error and does not submit when a required config field is left empty', () => {
        render(<Plugins auth={auth} plugins={[awsS3]} />);

        fireEvent.click(screen.getByRole('button', { name: /Configure/ }));
        // Leave Access Key / Secret Key blank and try to save.
        fireEvent.click(screen.getByRole('button', { name: 'Save Configuration' }));

        expect(screen.getByText('Access Key is required')).toBeInTheDocument();
        expect(screen.getByText('Secret Key is required')).toBeInTheDocument();
        expect(routerPost).not.toHaveBeenCalled();
    });

    it('uninstalling a non-core plugin opens an AlertDialog confirm (not window.confirm), with an accessible trigger label, and confirming deletes via the uninstall route', () => {
        const confirmSpy = vi.spyOn(window, 'confirm');
        render(<Plugins auth={auth} plugins={[awsS3]} />);

        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

        const uninstallButton = screen.getByRole('button', { name: 'Uninstall plugin' });
        fireEvent.click(uninstallButton);

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(screen.getByText(/Are you sure you want to uninstall/)).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Uninstall' }));

        expect(routeSpy).toHaveBeenCalledWith('admin.plugins.uninstall', 'aws-s3');
        expect(routerDelete).toHaveBeenCalledTimes(1);
        expect(routerDelete.mock.calls[0][0]).toBe('/admin.plugins.uninstall/aws-s3');

        // The dialog must stay open with a visible in-flight state — Radix's
        // AlertDialogAction auto-close is preventDefault()ed; it closes in onSuccess.
        const liveDialog = screen.getByRole('alertdialog');
        expect(within(liveDialog).getByRole('button', { name: 'Uninstalling...' })).toBeDisabled();
    });

    it('a core plugin shows the Core plugin badge and no uninstall option', () => {
        const { container } = render(<Plugins auth={auth} plugins={[paypal]} />);

        expect(screen.getByText('Core plugin')).toBeInTheDocument();
        const destructiveButtons = within(container).queryAllByRole('button').filter((btn) =>
            btn.className.includes('text-destructive')
        );
        expect(destructiveButtons).toHaveLength(0);
    });

    it('reflects active vs inactive visual state on the plugin card', () => {
        const { container } = render(<Plugins auth={auth} plugins={[paypal, awsS3]} />);

        expect(screen.getByText('Active')).toBeInTheDocument();

        const cards = container.querySelectorAll('[class*="opacity-75"]');
        // PayPal (active) should not carry the inactive-card opacity class,
        // while the inactive AWS S3 card should.
        expect(cards.length).toBeGreaterThanOrEqual(1);
        const opacityCard = cards[0];
        expect(opacityCard.textContent).toContain('AWS S3');
        expect(opacityCard.textContent).not.toContain('PayPal');
    });
});
