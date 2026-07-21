import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NewKeyDialog } from './NewKeyDialog';

describe('NewKeyDialog', () => {
    beforeEach(() => {
        Object.assign(navigator, {
            clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        Object.defineProperty(window, 'isSecureContext', { value: true, writable: true });
    });

    it('renders nothing when token is null', () => {
        const { container } = render(<NewKeyDialog token={null} onClose={() => {}} />);
        expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it('shows the plaintext token exactly once', () => {
        render(<NewKeyDialog token="sk_1|abcdef" onClose={() => {}} />);
        expect(screen.getByText('sk_1|abcdef')).toBeInTheDocument();
        expect(screen.getByText("Copy your key now. For security reasons, you won't be able to see it again.")).toBeInTheDocument();
    });

    it('copies the token to the clipboard', async () => {
        render(<NewKeyDialog token="sk_1|abcdef" onClose={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('sk_1|abcdef');
        });
    });

    it('calls onClose when Done is clicked', () => {
        const onClose = vi.fn();
        render(<NewKeyDialog token="sk_1|abcdef" onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: /Done/ }));
        expect(onClose).toHaveBeenCalled();
    });
});
