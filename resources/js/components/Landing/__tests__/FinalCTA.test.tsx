import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (returns the key as translation).

vi.mock('@inertiajs/react', () => ({
    router: { visit: vi.fn(), post: vi.fn() },
    Link: ({ children, href }: { children?: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

import { router } from '@inertiajs/react';
import { FinalCTA } from '../FinalCTA';

const guestAuth = { user: null };
const loggedInAuth = { user: { id: 1, name: 'A', email: 'a@b.c' } };

describe('FinalCTA', () => {
    let setItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    });

    afterEach(() => {
        setItemSpy.mockRestore();
    });

    it('renders default title and subtitle when no content', () => {
        render(<FinalCTA auth={guestAuth} />);

        expect(screen.getByText('Ready to build something amazing?')).toBeInTheDocument();
        expect(screen.getByText('Start building for free. No credit card required.')).toBeInTheDocument();
    });

    it('content overrides the default title/subtitle', () => {
        render(<FinalCTA auth={guestAuth} content={{ title: 'Custom Title', subtitle: 'Custom Sub' }} />);

        expect(screen.getByText('Custom Title')).toBeInTheDocument();
        expect(screen.getByText('Custom Sub')).toBeInTheDocument();
        expect(screen.queryByText('Ready to build something amazing?')).not.toBeInTheDocument();
        expect(screen.queryByText('Start building for free. No credit card required.')).not.toBeInTheDocument();
    });

    it('guest submit stores the prompt and visits register', async () => {
        const user = userEvent.setup();
        render(<FinalCTA auth={guestAuth} />);

        const textarea = screen.getByPlaceholderText('Describe what you want to build...');
        await user.type(textarea, 'build me a shop');

        const button = screen.getByRole('button', { name: /go/i });
        expect(button).toHaveTextContent('Go');
        await user.click(button);

        expect(setItemSpy).toHaveBeenCalledWith('landing_prompt', 'build me a shop');
        expect(router.visit).toHaveBeenCalledWith('/register');
        expect(router.post).not.toHaveBeenCalled();
    });

    it('logged-in submit posts to projects', async () => {
        const user = userEvent.setup();
        render(<FinalCTA auth={loggedInAuth} isPusherConfigured canCreateProject />);

        const textarea = screen.getByPlaceholderText('Describe what you want to build...');
        await user.type(textarea, 'make a blog');

        const button = screen.getByRole('button', { name: /start/i });
        expect(button).toHaveTextContent('Start');
        await user.click(button);

        expect(router.post).toHaveBeenCalledWith('/projects', { prompt: 'make a blog' });
        expect(router.visit).not.toHaveBeenCalled();
    });

    it('whitespace-only prompt does not navigate', async () => {
        const user = userEvent.setup();
        render(<FinalCTA auth={guestAuth} />);

        const textarea = screen.getByPlaceholderText('Describe what you want to build...');
        await user.type(textarea, '   ');

        const button = screen.getByRole('button', { name: /go/i });
        expect(button).toBeDisabled();

        const form = textarea.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(router.visit).not.toHaveBeenCalled();
        expect(router.post).not.toHaveBeenCalled();
    });

    it('prompt is trimmed before submit', async () => {
        const user = userEvent.setup();
        render(<FinalCTA auth={loggedInAuth} isPusherConfigured canCreateProject />);

        const textarea = screen.getByPlaceholderText('Describe what you want to build...');
        await user.type(textarea, '  spaced  ');

        const button = screen.getByRole('button', { name: /start/i });
        await user.click(button);

        expect(router.post).toHaveBeenCalledWith('/projects', { prompt: 'spaced' });
    });

    it('cmd/ctrl+Enter submits', async () => {
        const user = userEvent.setup();
        render(<FinalCTA auth={loggedInAuth} isPusherConfigured canCreateProject />);

        const textarea = screen.getByPlaceholderText('Describe what you want to build...');
        await user.type(textarea, 'quick');

        fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

        expect(router.post).toHaveBeenCalledWith('/projects', { prompt: 'quick' });
    });

    it('logged-in user is disabled + warned when pusher not configured', () => {
        render(<FinalCTA auth={loggedInAuth} isPusherConfigured={false} />);

        expect(
            screen.getByText('Real-time features are not configured. Please contact support.')
        ).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Describe what you want to build...')).toBeDisabled();
    });

    it('logged-in user is warned when cannot create project', () => {
        render(
            <FinalCTA
                auth={loggedInAuth}
                isPusherConfigured
                canCreateProject={false}
                cannotCreateReason="You have reached your project limit."
            />
        );

        expect(screen.getByText(/You have reached your project limit\./)).toBeInTheDocument();
        const link = screen.getByRole('link', { name: 'View Plans' });
        expect(link).toHaveAttribute('href', '/billing/plans');
    });

    it('guest is never disabled even without pusher', () => {
        render(<FinalCTA auth={guestAuth} isPusherConfigured={false} />);

        expect(screen.getByPlaceholderText('Describe what you want to build...')).not.toBeDisabled();
        expect(
            screen.queryByText('Real-time features are not configured. Please contact support.')
        ).not.toBeInTheDocument();
    });
});
