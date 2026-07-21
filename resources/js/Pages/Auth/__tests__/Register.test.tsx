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

vi.mock('@/components/Auth/SocialLoginButtons', () => ({
    SocialLoginButtons: () => null,
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

type RegisterData = {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    recaptcha_token: string;
};

type FormOverrides = {
    data?: Partial<RegisterData>;
    setData?: (...args: unknown[]) => void;
    processing?: boolean;
    errors?: Record<string, string>;
    reset?: (...args: unknown[]) => void;
};

function setup(overrides: FormOverrides = {}, recaptchaOverrides: { getToken?: (...args: unknown[]) => Promise<string>; isEnabled?: boolean } = {}) {
    vi.mocked(useForm).mockReturnValue({
        data: {
            name: '',
            email: '',
            password: '',
            password_confirmation: '',
            recaptcha_token: '',
            ...overrides.data,
        },
        setData: overrides.setData ?? vi.fn(),
        processing: overrides.processing ?? false,
        errors: overrides.errors ?? {},
        reset: overrides.reset ?? vi.fn(),
    } as unknown as ReturnType<typeof useForm>);

    vi.mocked(useReCaptcha).mockReturnValue({
        getToken: vi.fn().mockResolvedValue('tok-abc'),
        isEnabled: false,
        ...recaptchaOverrides,
    } as unknown as ReturnType<typeof useReCaptcha>);
}

// Import after mocks
import Register from '../Register';

beforeEach(() => {
    vi.clearAllMocks();
    setup();
});

describe('Register', () => {
    it('renders all four fields and the heading', () => {
        render(<Register />);

        expect(screen.getByText('Create your account')).toBeInTheDocument();
        expect(screen.getByLabelText('Name')).toBeInTheDocument();
        expect(screen.getByLabelText('Email')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    });

    it('renders each field validation error', () => {
        setup({
            errors: {
                name: 'Name required',
                email: 'Email invalid',
                password: 'Too short',
                password_confirmation: 'No match',
            },
        });
        render(<Register />);

        expect(screen.getByText('Name required')).toBeInTheDocument();
        expect(screen.getByText('Email invalid')).toBeInTheDocument();
        expect(screen.getByText('Too short')).toBeInTheDocument();
        expect(screen.getByText('No match')).toBeInTheDocument();
    });

    it('renders the recaptcha error', () => {
        setup({ errors: { recaptcha_token: 'reCAPTCHA failed.' } });
        render(<Register />);

        expect(screen.getByText('reCAPTCHA failed.')).toBeInTheDocument();
    });

    it('disables the button and shows Creating account... while processing', () => {
        setup({ processing: true });
        render(<Register />);

        const button = screen.getByRole('button', { name: 'Creating account...' });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('renders both password fields masked (type="password") by default', () => {
        render(<Register />);

        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
        expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'password');
    });

    it('submitting with recaptcha DISABLED posts an empty token without calling getToken', async () => {
        const getToken = vi.fn().mockResolvedValue('tok-abc');
        setup(
            { data: { name: 'Ann', email: 'a@b.c', password: 'secret123', password_confirmation: 'secret123' } },
            { getToken, isEnabled: false }
        );
        render(<Register />);

        const button = screen.getByRole('button', { name: 'Create Account' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        await waitFor(() => expect(router.post).toHaveBeenCalled());

        expect(getToken).not.toHaveBeenCalled();
        expect(router.post).toHaveBeenCalledWith(
            '/register',
            expect.objectContaining({
                name: 'Ann',
                email: 'a@b.c',
                password: 'secret123',
                password_confirmation: 'secret123',
                recaptcha_token: '',
            }),
            expect.any(Object)
        );
    });

    it('submitting with recaptcha ENABLED fetches a token and includes it', async () => {
        const getToken = vi.fn().mockResolvedValue('tok-xyz');
        setup(
            { data: { name: 'Ann', email: 'a@b.c', password: 'secret123', password_confirmation: 'secret123' } },
            { getToken, isEnabled: true }
        );
        render(<Register />);

        const button = screen.getByRole('button', { name: 'Create Account' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        await waitFor(() => expect(router.post).toHaveBeenCalled());

        expect(getToken).toHaveBeenCalledWith('register');
        expect(router.post).toHaveBeenCalledWith(
            '/register',
            expect.objectContaining({ recaptcha_token: 'tok-xyz' }),
            expect.any(Object)
        );
    });

    it('onFinish resets the password fields and onError toasts', async () => {
        const reset = vi.fn();
        setup(
            { data: { name: 'Ann', email: 'a@b.c', password: 'secret123', password_confirmation: 'secret123' }, reset },
            { isEnabled: false }
        );
        render(<Register />);

        const button = screen.getByRole('button', { name: 'Create Account' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        await waitFor(() => expect(router.post).toHaveBeenCalled());

        const options = vi.mocked(router.post).mock.calls[0][2] as {
            onFinish: () => void;
            onError: () => void;
        };

        options.onFinish();
        expect(reset).toHaveBeenCalledWith('password', 'password_confirmation');

        options.onError();
        expect(toast.error).toHaveBeenCalledWith('Registration failed');
    });
});
