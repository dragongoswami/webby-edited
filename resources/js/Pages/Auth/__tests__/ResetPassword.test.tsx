import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';

// Mock all Inertia hooks
vi.mock('@inertiajs/react', () => ({
    useForm: vi.fn(),
    Head: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
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

type ResetPasswordData = {
    token: string;
    email: string;
    password: string;
    password_confirmation: string;
};

type FormOverrides = {
    data?: Partial<ResetPasswordData>;
    setData?: (...args: unknown[]) => void;
    post?: (...args: unknown[]) => void;
    processing?: boolean;
    errors?: Record<string, string>;
    reset?: (...args: unknown[]) => void;
};

function setup(overrides: FormOverrides = {}) {
    vi.mocked(useForm).mockReturnValue({
        data: {
            token: 'tok',
            email: 'user@example.com',
            password: '',
            password_confirmation: '',
            ...overrides.data,
        },
        setData: overrides.setData ?? vi.fn(),
        post: overrides.post ?? vi.fn(),
        processing: overrides.processing ?? false,
        errors: overrides.errors ?? {},
        reset: overrides.reset ?? vi.fn(),
    } as unknown as ReturnType<typeof useForm>);
}

// Import after mocks
import ResetPassword from '../ResetPassword';

beforeEach(() => {
    vi.clearAllMocks();
    setup();
});

describe('ResetPassword', () => {
    it('renders heading, prefilled email, and password fields', () => {
        setup({ data: { email: 'user@example.com' } });
        render(<ResetPassword token="tok" email="user@example.com" />);

        expect(screen.getByText('Reset password')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toHaveValue('user@example.com');
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument();
    });

    it('renders both password fields masked (type="password") by default', () => {
        render(<ResetPassword token="tok" email="user@example.com" />);

        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
        expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'password');
    });

    it('renders each field validation error', () => {
        setup({
            errors: {
                email: 'Email invalid',
                password: 'Too weak',
                password_confirmation: 'No match',
            },
        });
        render(<ResetPassword token="tok" email="user@example.com" />);

        expect(screen.getByText('Email invalid')).toBeInTheDocument();
        expect(screen.getByText('Too weak')).toBeInTheDocument();
        expect(screen.getByText('No match')).toBeInTheDocument();
    });

    it('disables the button and shows Resetting… while processing', () => {
        setup({ processing: true });
        render(<ResetPassword token="tok" email="user@example.com" />);

        const button = screen.getByRole('button', { name: 'Resetting...' });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('submitting posts to password.store', () => {
        const post = vi.fn();
        setup({ post });
        render(<ResetPassword token="tok" email="user@example.com" />);

        const button = screen.getByRole('button', { name: 'Reset Password' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(post).toHaveBeenCalledWith(
            '/password.store',
            expect.objectContaining({
                onFinish: expect.any(Function),
                onSuccess: expect.any(Function),
                onError: expect.any(Function),
            })
        );
    });

    it('onFinish resets password fields; onSuccess and onError toast', () => {
        const post = vi.fn();
        const reset = vi.fn();
        setup({ post, reset });
        render(<ResetPassword token="tok" email="user@example.com" />);

        const button = screen.getByRole('button', { name: 'Reset Password' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        const options = vi.mocked(post).mock.calls[0][1] as {
            onFinish: () => void;
            onSuccess: () => void;
            onError: () => void;
        };

        options.onFinish();
        expect(reset).toHaveBeenCalledWith('password', 'password_confirmation');

        options.onSuccess();
        expect(toast.success).toHaveBeenCalledWith('Password reset successfully');

        options.onError();
        expect(toast.error).toHaveBeenCalledWith('Failed to reset password');
    });
});
