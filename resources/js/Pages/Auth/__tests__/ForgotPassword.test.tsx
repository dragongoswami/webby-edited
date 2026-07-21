import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useForm, router } from '@inertiajs/react';
import { useReCaptcha } from '@/components/Auth/ReCaptchaProvider';
import { toast } from 'sonner';

// Mock all Inertia hooks
vi.mock('@inertiajs/react', () => ({
    useForm: vi.fn(),
    Head: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    Link: ({ children, ...props }: { children?: React.ReactNode; href: string }) => <a {...props}>{children}</a>,
    router: { post: vi.fn() },
}));

vi.mock('@/Layouts/GuestLayout', () => ({
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/Auth/ReCaptchaProvider', () => ({
    useReCaptcha: vi.fn(),
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
    data?: { email: string; recaptcha_token: string };
    setData?: (...args: unknown[]) => void;
    processing?: boolean;
    errors?: Record<string, string>;
};

function setup(overrides: FormOverrides = {}, recaptchaOverrides: { getToken?: (...args: unknown[]) => Promise<string>; isEnabled?: boolean } = {}) {
    vi.mocked(useForm).mockReturnValue({
        data: { email: '', recaptcha_token: '' },
        setData: vi.fn(),
        processing: false,
        errors: {},
        ...overrides,
    } as unknown as ReturnType<typeof useForm>);

    vi.mocked(useReCaptcha).mockReturnValue({
        getToken: vi.fn().mockResolvedValue('tok-123'),
        isEnabled: false,
        ...recaptchaOverrides,
    } as unknown as ReturnType<typeof useReCaptcha>);
}

// Import after mocks
import ForgotPassword from '../ForgotPassword';

beforeEach(() => {
    vi.clearAllMocks();
    setup();
});

describe('ForgotPassword', () => {
    it('renders the heading and email field', () => {
        render(<ForgotPassword />);

        expect(screen.getByText('Forgot password?')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeInTheDocument();
    });

    it('shows the status banner when status prop is set', () => {
        const { rerender } = render(<ForgotPassword status="We emailed your reset link." />);
        expect(screen.getByText('We emailed your reset link.')).toBeInTheDocument();

        rerender(<ForgotPassword />);
        expect(screen.queryByText('We emailed your reset link.')).not.toBeInTheDocument();
    });

    it('renders an email validation error', () => {
        setup({ errors: { email: 'The email field is required.' } });
        render(<ForgotPassword />);

        expect(screen.getByText('The email field is required.')).toBeInTheDocument();
    });

    it('renders a recaptcha error', () => {
        setup({ errors: { recaptcha_token: 'reCAPTCHA failed.' } });
        render(<ForgotPassword />);

        expect(screen.getByText('reCAPTCHA failed.')).toBeInTheDocument();
    });

    it('disables the button and shows Sending while processing', () => {
        setup({ processing: true });
        render(<ForgotPassword />);

        const button = screen.getByRole('button', { name: 'Sending...' });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('submitting with recaptcha DISABLED posts an empty token and does not call getToken', async () => {
        const getToken = vi.fn().mockResolvedValue('tok-123');
        setup({ data: { email: 'a@b.c', recaptcha_token: '' } }, { getToken, isEnabled: false });
        render(<ForgotPassword />);

        const button = screen.getByRole('button', { name: 'Send Reset Link' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        await waitFor(() => expect(router.post).toHaveBeenCalled());

        expect(getToken).not.toHaveBeenCalled();
        expect(router.post).toHaveBeenCalledWith(
            '/password.email',
            expect.objectContaining({ email: 'a@b.c', recaptcha_token: '' }),
            expect.any(Object)
        );
    });

    it('submitting with recaptcha ENABLED fetches a token and includes it in the post', async () => {
        const getToken = vi.fn().mockResolvedValue('tok-xyz');
        setup({ data: { email: 'a@b.c', recaptcha_token: '' } }, { getToken, isEnabled: true });
        render(<ForgotPassword />);

        const button = screen.getByRole('button', { name: 'Send Reset Link' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        await waitFor(() => expect(router.post).toHaveBeenCalled());

        expect(getToken).toHaveBeenCalledWith('forgot_password');
        expect(router.post).toHaveBeenCalledWith(
            '/password.email',
            expect.objectContaining({ recaptcha_token: 'tok-xyz' }),
            expect.any(Object)
        );
    });

    it('success and error callbacks fire the right toast', async () => {
        setup({ data: { email: 'a@b.c', recaptcha_token: '' } }, { isEnabled: false });
        render(<ForgotPassword />);

        const button = screen.getByRole('button', { name: 'Send Reset Link' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        await waitFor(() => expect(router.post).toHaveBeenCalled());

        const options = vi.mocked(router.post).mock.calls[0][2] as {
            onSuccess: () => void;
            onError: () => void;
        };

        options.onSuccess();
        expect(toast.success).toHaveBeenCalledWith('Reset link sent to your email');

        options.onError();
        expect(toast.error).toHaveBeenCalledWith('Failed to send reset link');
    });
});
