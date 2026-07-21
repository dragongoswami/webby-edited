import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';

// Mock all Inertia hooks
vi.mock('@inertiajs/react', () => ({
    useForm: vi.fn(),
    Head: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Link: ({ children, ...p }: React.PropsWithChildren<Record<string, unknown>>) => <a {...p}>{children}</a>,
}));

vi.mock('@/Layouts/GuestLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (s: string) => s }),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock route() global
vi.stubGlobal('route', (name: string) => `/${name}`);

type FormOverrides = {
    post?: (...args: unknown[]) => void;
    processing?: boolean;
};

function setup(overrides: FormOverrides = {}) {
    vi.mocked(useForm).mockReturnValue({
        data: {},
        setData: vi.fn(),
        post: overrides.post ?? vi.fn(),
        processing: overrides.processing ?? false,
        errors: {},
    } as unknown as ReturnType<typeof useForm>);
}

// Import after mocks
import VerifyEmail from '../VerifyEmail';

beforeEach(() => {
    vi.clearAllMocks();
    setup();
});

describe('VerifyEmail', () => {
    it('renders the heading and resend button', () => {
        render(<VerifyEmail />);

        expect(screen.getByText('Verify your email')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Resend Verification Email' })).toBeInTheDocument();
        expect(screen.getByText('Log Out')).toBeInTheDocument();
    });

    it('shows the verification-link-sent banner only for that status', () => {
        const { rerender } = render(<VerifyEmail status="verification-link-sent" />);
        expect(screen.getByText('A new verification link has been sent to your email address.')).toBeInTheDocument();

        rerender(<VerifyEmail status="something-else" />);
        expect(screen.queryByText('A new verification link has been sent to your email address.')).not.toBeInTheDocument();

        rerender(<VerifyEmail />);
        expect(screen.queryByText('A new verification link has been sent to your email address.')).not.toBeInTheDocument();
    });

    it('disables the button and shows Sending… while processing', () => {
        setup({ processing: true });
        render(<VerifyEmail />);

        const button = screen.getByRole('button', { name: 'Sending...' });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('submitting posts to verification.send', () => {
        const post = vi.fn();
        setup({ post });
        render(<VerifyEmail />);

        const button = screen.getByRole('button', { name: 'Resend Verification Email' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(post).toHaveBeenCalledWith(
            '/verification.send',
            expect.objectContaining({
                onSuccess: expect.any(Function),
                onError: expect.any(Function),
            })
        );
    });

    it('onSuccess and onError fire the right toast', () => {
        const post = vi.fn();
        setup({ post });
        render(<VerifyEmail />);

        const button = screen.getByRole('button', { name: 'Resend Verification Email' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        const options = vi.mocked(post).mock.calls[0][1] as {
            onSuccess: () => void;
            onError: () => void;
        };

        options.onSuccess();
        expect(toast.success).toHaveBeenCalledWith('Verification email sent');

        options.onError();
        expect(toast.error).toHaveBeenCalledWith('Failed to send verification email');
    });
});
