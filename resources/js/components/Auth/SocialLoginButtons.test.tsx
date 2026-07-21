import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SocialLoginButtons } from './SocialLoginButtons';

// --- Boundary mock -------------------------------------------------------
// Only usePage's appSettings matter to this component; mock @inertiajs/react
// so each test can configure which login flags are enabled.
let pageProps: Record<string, unknown> = {};

vi.mock('@inertiajs/react', () => ({
    usePage: () => ({ props: pageProps }),
}));

function setAppSettings(overrides: Record<string, unknown> = {}) {
    pageProps = {
        appSettings: {
            google_login_enabled: false,
            facebook_login_enabled: false,
            github_login_enabled: false,
            ...overrides,
        },
    };
}

describe('SocialLoginButtons', () => {
    it('renders nothing when all providers are disabled', () => {
        setAppSettings();
        const { container } = render(<SocialLoginButtons />);

        expect(container.firstChild).toBeNull();
    });

    it('renders nothing when appSettings flags are undefined', () => {
        pageProps = { appSettings: {} };
        const { container } = render(<SocialLoginButtons />);

        expect(container.firstChild).toBeNull();
    });

    it('renders exactly one button for google only, with the divider, in login mode by default', () => {
        setAppSettings({ google_login_enabled: true });
        render(<SocialLoginButtons />);

        expect(screen.getByText('Or continue with')).toBeInTheDocument();

        const link = screen.getByRole('link', { name: 'Sign in with Google' });
        expect(link).toHaveAttribute('href', '/auth/google');

        expect(screen.queryByRole('link', { name: /Facebook/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /GitHub/ })).not.toBeInTheDocument();
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('renders three buttons in google, facebook, github order when all are enabled', () => {
        setAppSettings({
            google_login_enabled: true,
            facebook_login_enabled: true,
            github_login_enabled: true,
        });
        render(<SocialLoginButtons />);

        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(3);
        expect(links[0]).toHaveAttribute('href', '/auth/google');
        expect(links[1]).toHaveAttribute('href', '/auth/facebook');
        expect(links[2]).toHaveAttribute('href', '/auth/github');
    });

    it('uses "Sign up with :provider" text in register mode', () => {
        setAppSettings({ github_login_enabled: true });
        render(<SocialLoginButtons mode="register" />);

        const link = screen.getByRole('link', { name: 'Sign up with GitHub' });
        expect(link).toHaveAttribute('href', '/auth/github');
    });

    it('uses "Sign in with :provider" text in login mode', () => {
        setAppSettings({ github_login_enabled: true });
        render(<SocialLoginButtons mode="login" />);

        expect(screen.getByRole('link', { name: 'Sign in with GitHub' })).toBeInTheDocument();
    });

    it('defaults to login-mode text when the mode prop is omitted', () => {
        setAppSettings({ facebook_login_enabled: true });
        render(<SocialLoginButtons />);

        expect(screen.getByRole('link', { name: 'Sign in with Facebook' })).toBeInTheDocument();
    });

    it('renders each enabled provider as an anchor link', () => {
        setAppSettings({ google_login_enabled: true, github_login_enabled: true });
        render(<SocialLoginButtons />);

        const googleLink = screen.getByRole('link', { name: 'Sign in with Google' });
        const githubLink = screen.getByRole('link', { name: 'Sign in with GitHub' });
        expect(googleLink.tagName).toBe('A');
        expect(githubLink.tagName).toBe('A');
    });

    it('gates a disabled provider out of a subset selection (google+github enabled, facebook disabled)', () => {
        setAppSettings({ google_login_enabled: true, github_login_enabled: true });
        render(<SocialLoginButtons />);

        expect(screen.getAllByRole('link')).toHaveLength(2);
        expect(screen.queryByRole('link', { name: /Facebook/ })).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign in with Google' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Sign in with GitHub' })).toBeInTheDocument();
    });

    it('renders an icon element inside each provider button', () => {
        setAppSettings({
            google_login_enabled: true,
            facebook_login_enabled: true,
            github_login_enabled: true,
        });
        render(<SocialLoginButtons />);

        const links = screen.getAllByRole('link');
        links.forEach((link) => {
            expect(link.querySelector('svg')).toBeInTheDocument();
        });
    });

    it('does not render the divider when no providers are enabled', () => {
        setAppSettings();
        render(<SocialLoginButtons />);

        expect(screen.queryByText('Or continue with')).not.toBeInTheDocument();
    });
});
