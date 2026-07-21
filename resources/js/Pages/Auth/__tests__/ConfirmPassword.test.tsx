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

type ConfirmPasswordData = {
    password: string;
};

type FormOverrides = {
    data?: Partial<ConfirmPasswordData>;
    setData?: (...args: unknown[]) => void;
    post?: (...args: unknown[]) => void;
    processing?: boolean;
    errors?: Record<string, string>;
    reset?: (...args: unknown[]) => void;
};

function setup(overrides: FormOverrides = {}) {
    vi.mocked(useForm).mockReturnValue({
        data: {
            password: '',
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
import ConfirmPassword from '../ConfirmPassword';

beforeEach(() => {
    vi.clearAllMocks();
    setup();
});

describe('ConfirmPassword', () => {
    it('renders the heading and password field', () => {
        render(<ConfirmPassword />);

        expect(screen.getByText('Confirm password')).toBeInTheDocument();
        expect(screen.getByLabelText('Password')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('renders the password field masked (type="password") by default', () => {
        render(<ConfirmPassword />);

        expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    });

    it('renders a password validation error', () => {
        setup({ errors: { password: 'The provided password is incorrect.' } });
        render(<ConfirmPassword />);

        expect(screen.getByText('The provided password is incorrect.')).toBeInTheDocument();
    });

    it('disables the button and shows Confirming… while processing', () => {
        setup({ processing: true });
        render(<ConfirmPassword />);

        const button = screen.getByRole('button', { name: 'Confirming...' });
        expect(button).toBeInTheDocument();
        expect(button).toBeDisabled();
    });

    it('submitting posts to password.confirm', () => {
        const post = vi.fn();
        setup({ post });
        render(<ConfirmPassword />);

        const button = screen.getByRole('button', { name: 'Confirm' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        expect(post).toHaveBeenCalledWith(
            '/password.confirm',
            expect.objectContaining({
                onFinish: expect.any(Function),
                onError: expect.any(Function),
            })
        );
    });

    it('onFinish resets the password and onError toasts', () => {
        const post = vi.fn();
        const reset = vi.fn();
        setup({ post, reset });
        render(<ConfirmPassword />);

        const button = screen.getByRole('button', { name: 'Confirm' });
        const form = button.closest('form') as HTMLFormElement;
        fireEvent.submit(form);

        const options = vi.mocked(post).mock.calls[0][1] as {
            onFinish: () => void;
            onError: () => void;
        };

        options.onFinish();
        expect(reset).toHaveBeenCalledWith('password');

        options.onError();
        expect(toast.error).toHaveBeenCalledWith('Incorrect password');
    });
});
