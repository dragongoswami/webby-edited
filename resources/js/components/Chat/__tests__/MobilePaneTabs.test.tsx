import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import MobilePaneTabs from '../MobilePaneTabs';

describe('MobilePaneTabs', () => {
    it('renders a Chat and a Preview button, each at least 48px tall', () => {
        render(<MobilePaneTabs pane="chat" onChange={vi.fn()} showPreviewDot={false} />);

        const chatButton = screen.getByRole('button', { name: 'Chat' });
        const previewButton = screen.getByRole('button', { name: 'Preview' });

        expect(chatButton.className).toContain('h-12');
        expect(previewButton.className).toContain('h-12');
    });

    it('marks the active pane button as aria-pressed', () => {
        render(<MobilePaneTabs pane="chat" onChange={vi.fn()} showPreviewDot={false} />);

        expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('calls onChange with "preview" when the Preview tab is clicked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<MobilePaneTabs pane="chat" onChange={onChange} showPreviewDot={false} />);

        await user.click(screen.getByRole('button', { name: 'Preview' }));

        expect(onChange).toHaveBeenCalledWith('preview');
    });

    it('renders a pulse dot on the Preview tab when showPreviewDot is true', () => {
        render(<MobilePaneTabs pane="chat" onChange={vi.fn()} showPreviewDot={true} />);

        expect(screen.getByTestId('preview-dot')).toBeInTheDocument();
    });

    it('does not render a pulse dot when showPreviewDot is false', () => {
        render(<MobilePaneTabs pane="chat" onChange={vi.fn()} showPreviewDot={false} />);

        expect(screen.queryByTestId('preview-dot')).not.toBeInTheDocument();
    });

    it('hides itself at md breakpoint and up', () => {
        const { container } = render(<MobilePaneTabs pane="chat" onChange={vi.fn()} showPreviewDot={false} />);

        expect(container.firstChild).toHaveClass('md:hidden');
    });
});
