import { useEffect, useRef, type MutableRefObject } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// LanguageContext's useTranslation is globally mocked in resources/js/test/setup.ts
// (returns the key as translation, locale: 'en', isRtl: false).

vi.mock('@inertiajs/react', () => ({
    router: { post: vi.fn(), visit: vi.fn(), on: vi.fn(() => vi.fn()) },
    Link: ({ children, ...p }: { children?: React.ReactNode; href: string }) => <a {...p}>{children}</a>,
}));

vi.mock('use-scramble', () => ({
    // Mimic the real hook's DOM-imperative behavior closely enough that the
    // headline text still appears in the rendered output.
    useScramble: ({ text }: { text: string }) => {
        const ref = useRef<HTMLElement | null>(null) as MutableRefObject<HTMLElement | null>;
        useEffect(() => {
            if (ref.current) {
                ref.current.textContent = text;
            }
        }, [text]);
        return { ref, replay: vi.fn() };
    },
}));

vi.mock('axios', () => ({
    default: {
        get: vi.fn(() => Promise.resolve({ data: null })),
    },
}));

import { router } from '@inertiajs/react';
import { HeroSection } from '../HeroSection';

const guestAuth = { user: null };
const loggedInAuth = { user: { id: 1, name: 'A', email: 'a@b.c' } };

const baseProps = {
    initialSuggestions: [] as string[],
    initialTypingPrompts: [] as string[],
    initialHeadline: 'Build anything',
    initialSubtitle: 'With AI',
};

describe('HeroSection', () => {
    let setItemSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    });

    afterEach(() => {
        setItemSpy.mockRestore();
    });

    it('renders the headline and subtitle', async () => {
        render(<HeroSection auth={guestAuth} {...baseProps} />);

        expect(await screen.findByText('Build anything')).toBeInTheDocument();
        expect(screen.getByText('With AI')).toBeInTheDocument();
    });

    it('renders suggestion chips', async () => {
        render(
            <HeroSection
                auth={guestAuth}
                {...baseProps}
                initialSuggestions={['a coffee shop site', 'a portfolio']}
            />
        );

        expect(await screen.findAllByText('a coffee shop site')).toHaveLength(2);
        expect(screen.getAllByText('a portfolio')).toHaveLength(2);
    });

    it('clicking a suggestion fills the prompt', async () => {
        const user = userEvent.setup();
        render(
            <HeroSection auth={guestAuth} {...baseProps} initialSuggestions={['a coffee shop site']} />
        );

        const [chip] = await screen.findAllByText('a coffee shop site');
        await user.click(chip);

        const textarea = screen.getByRole('textbox');
        expect(textarea).toHaveValue('a coffee shop site');
    });

    it('guest submit stores the prompt and visits register', async () => {
        const user = userEvent.setup();
        render(<HeroSection auth={guestAuth} {...baseProps} />);

        const textarea = screen.getByRole('textbox');
        await user.type(textarea, 'make a blog');

        const form = textarea.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(setItemSpy).toHaveBeenCalledWith('landing_prompt', 'make a blog');
        expect(router.visit).toHaveBeenCalledWith('/register');
        expect(router.post).not.toHaveBeenCalled();
    });

    it('logged-in submit posts to projects', async () => {
        const user = userEvent.setup();
        render(
            <HeroSection
                auth={loggedInAuth}
                {...baseProps}
                isPusherConfigured
                canCreateProject
            />
        );

        const textarea = screen.getByRole('textbox');
        await user.type(textarea, 'make a shop');

        const form = textarea.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(router.post).toHaveBeenCalledWith('/projects', { prompt: 'make a shop' });
        expect(router.visit).not.toHaveBeenCalled();
    });

    it('whitespace-only prompt does not navigate', async () => {
        const user = userEvent.setup();
        render(<HeroSection auth={guestAuth} {...baseProps} />);

        const textarea = screen.getByRole('textbox');
        await user.type(textarea, '   ');

        const form = textarea.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(router.visit).not.toHaveBeenCalled();
        expect(router.post).not.toHaveBeenCalled();
    });

    it('prompt is trimmed', async () => {
        const user = userEvent.setup();
        render(
            <HeroSection
                auth={loggedInAuth}
                {...baseProps}
                isPusherConfigured
                canCreateProject
            />
        );

        const textarea = screen.getByRole('textbox');
        await user.type(textarea, '  spaced  ');

        const form = textarea.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(router.post).toHaveBeenCalledWith('/projects', { prompt: 'spaced' });
    });

    it('cmd/ctrl+Enter submits', async () => {
        const user = userEvent.setup();
        render(
            <HeroSection
                auth={loggedInAuth}
                {...baseProps}
                isPusherConfigured
                canCreateProject
            />
        );

        const textarea = screen.getByRole('textbox');
        await user.type(textarea, 'quick');

        fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

        expect(router.post).toHaveBeenCalledWith('/projects', { prompt: 'quick' });
    });

    it('logged-in user is disabled + warned when pusher is not configured', () => {
        render(<HeroSection auth={loggedInAuth} {...baseProps} isPusherConfigured={false} />);

        expect(
            screen.getByText('Real-time features are not configured. Please contact support.')
        ).toBeInTheDocument();
        expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('logged-in user is warned when cannot create project', () => {
        render(
            <HeroSection
                auth={loggedInAuth}
                {...baseProps}
                isPusherConfigured
                canCreateProject={false}
                cannotCreateReason="Limit reached."
            />
        );

        expect(screen.getByText(/Limit reached\./)).toBeInTheDocument();
        const link = screen.getByRole('link', { name: 'View Plans' });
        expect(link).toHaveAttribute('href', '/billing/plans');
    });

    it('guest is never disabled even without pusher', () => {
        render(<HeroSection auth={guestAuth} {...baseProps} isPusherConfigured={false} />);

        expect(screen.getByRole('textbox')).not.toBeDisabled();
        expect(
            screen.queryByText('Real-time features are not configured. Please contact support.')
        ).not.toBeInTheDocument();
    });

    it('the h-dvh root section allows vertical overflow scrolling', () => {
        const { container } = render(<HeroSection auth={guestAuth} {...baseProps} />);
        const section = container.querySelector('section');

        expect(section).not.toBeNull();
        expect(section?.className).toContain('h-dvh');
        expect(section?.className).toContain('overflow-y-auto');
    });
});
