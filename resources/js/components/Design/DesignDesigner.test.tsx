import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { DesignDesigner } from './DesignDesigner';
import type { DesignSystemOption } from '@/types/design';

// Radix Select needs these pointer APIs, which jsdom doesn't implement.
beforeAll(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
    Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
    Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

vi.mock('./DesignSystemThumbnail', () => ({
    DesignSystemThumbnail: ({ slug, accent }: { slug: string; accent?: string | null }) => (
        <div data-testid="thumb" data-accent={accent ?? 'none'} data-slug={slug} />
    ),
}));

vi.mock('./DesignSystemPreviewModal', () => ({
    DesignSystemPreviewModal: ({ open, slug, accent }: { open: boolean; slug: string; accent?: string | null }) =>
        open ? <div data-testid="preview-modal" data-slug={slug} data-accent={accent ?? 'none'} /> : null,
}));

const systemA: DesignSystemOption = {
    id: 1,
    slug: 'substrate',
    name: 'Substrate',
    description: 'The default system',
    is_default: true,
    has_preview: true,
    accents: ['warm', 'cool'],
};

const systemB: DesignSystemOption = {
    id: 2,
    slug: 'mono',
    name: 'Mono',
    description: null,
    is_default: false,
    has_preview: false,
    accents: ['slate'],
};

const systemC: DesignSystemOption = {
    id: 3,
    slug: 'blank',
    name: 'Blank',
    description: null,
    is_default: false,
    has_preview: false,
    accents: [],
};

function cardFor(name: string) {
    const heading = screen.getByText(name);
    // The outer relative rounded-lg border-2 wrapper carries the selection class.
    return heading.closest('div.relative') as HTMLElement;
}

/** Exact Tailwind class-token check (avoids false positives from e.g. hover:border-primary/50). */
function hasClass(el: HTMLElement, className: string) {
    return el.className.split(/\s+/).includes(className);
}

describe('DesignDesigner', () => {
    const onApply = vi.fn().mockResolvedValue(undefined);

    beforeEach(() => {
        vi.clearAllMocks();
        onApply.mockResolvedValue(undefined);
    });

    it('renders a card per system, and an empty message when none installed', () => {
        const { rerender } = render(
            <DesignDesigner
                designSystems={[systemA, systemB]}
                currentSystemId={null}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        expect(screen.getByText('Substrate')).toBeInTheDocument();
        expect(screen.getByText('Mono')).toBeInTheDocument();

        rerender(
            <DesignDesigner
                designSystems={[]}
                currentSystemId={null}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        expect(screen.getByText('No design systems are installed.')).toBeInTheDocument();
    });

    it('highlights the current selection', () => {
        render(
            <DesignDesigner
                designSystems={[systemA, systemB]}
                currentSystemId={1}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        expect(hasClass(cardFor('Substrate'), 'border-primary')).toBe(true);
        expect(hasClass(cardFor('Mono'), 'border-primary')).toBe(false);
    });

    it('selects a system on click and shows Unsaved changes when it differs from current', async () => {
        const user = userEvent.setup();
        render(
            <DesignDesigner
                designSystems={[systemA, systemB]}
                currentSystemId={1}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();

        // Click the main select button (not the Preview button).
        await user.click(screen.getByText('Mono').closest('button') as HTMLElement);

        expect(hasClass(cardFor('Mono'), 'border-primary')).toBe(true);
        expect(hasClass(cardFor('Substrate'), 'border-primary')).toBe(false);
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });

    it('resets the accent when the new system does not offer it, keeps it when it does', async () => {
        const user = userEvent.setup();
        const systemAWithSameAccent: DesignSystemOption = { ...systemA, id: 4, slug: 'substrate2', name: 'Substrate 2', accents: ['warm', 'cool'] };

        render(
            <DesignDesigner
                designSystems={[systemA, systemB, systemAWithSameAccent]}
                currentSystemId={1}
                currentAccent="warm"
                onApply={onApply}
                isSaving={false}
            />
        );

        // Selected thumb starts with the warm accent.
        const selectedThumbBefore = within(cardFor('Substrate')).getByTestId('thumb');
        expect(selectedThumbBefore).toHaveAttribute('data-accent', 'warm');

        // Switching to a system whose accents do NOT include 'warm' resets to null.
        await user.click(screen.getByText('Mono').closest('button') as HTMLElement);
        const monoThumb = within(cardFor('Mono')).getByTestId('thumb');
        expect(monoThumb).toHaveAttribute('data-accent', 'none');
        // Its accent select shows the automatic/default option.
        expect(screen.getByRole('combobox')).toHaveTextContent('Default accent');

    });

    it('keeps the accent when switching to a system that also offers it', async () => {
        const user = userEvent.setup();
        const systemAWithSameAccent: DesignSystemOption = { ...systemA, id: 4, slug: 'substrate2', name: 'Substrate 2', accents: ['warm', 'cool'] };

        render(
            <DesignDesigner
                designSystems={[systemA, systemAWithSameAccent]}
                currentSystemId={1}
                currentAccent="warm"
                onApply={onApply}
                isSaving={false}
            />
        );

        await user.click(screen.getByText('Substrate 2').closest('button') as HTMLElement);
        const selectedThumb = within(cardFor('Substrate 2')).getByTestId('thumb');
        expect(selectedThumb).toHaveAttribute('data-accent', 'warm');
        expect(screen.getByRole('combobox')).toHaveTextContent('warm');
    });

    it('shows the accent Select only when the selected system has accents', async () => {
        const user = userEvent.setup();
        render(
            <DesignDesigner
                designSystems={[systemA, systemC]}
                currentSystemId={1}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        expect(screen.getByRole('combobox')).toBeInTheDocument();

        await user.click(screen.getByText('Blank').closest('button') as HTMLElement);
        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('maps the accent Select value/selection: automatic <-> null', async () => {
        const user = userEvent.setup();
        render(
            <DesignDesigner
                designSystems={[systemA]}
                currentSystemId={1}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        // Initial value maps null -> 'automatic' label.
        expect(screen.getByRole('combobox')).toHaveTextContent('Default accent');

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: 'cool' }));

        expect(screen.getByRole('combobox')).toHaveTextContent('cool');
        const thumb = within(cardFor('Substrate')).getByTestId('thumb');
        expect(thumb).toHaveAttribute('data-accent', 'cool');

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: 'Default accent' }));
        expect(screen.getByRole('combobox')).toHaveTextContent('Default accent');
        expect(within(cardFor('Substrate')).getByTestId('thumb')).toHaveAttribute('data-accent', 'none');
    });

    it('shows Unsaved changes only once selection differs from current', async () => {
        const user = userEvent.setup();
        render(
            <DesignDesigner
                designSystems={[systemA, systemB]}
                currentSystemId={1}
                currentAccent="warm"
                onApply={onApply}
                isSaving={false}
            />
        );
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();

        await user.click(screen.getByRole('combobox'));
        await user.click(await screen.findByRole('option', { name: 'cool' }));
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    });

    describe('Ask AI to apply button (applyDisabled matrix)', () => {
        it('is disabled when there is no pending change', () => {
            render(
                <DesignDesigner
                    designSystems={[systemA, systemB]}
                    currentSystemId={1}
                    currentAccent={null}
                    onApply={onApply}
                    isSaving={false}
                />
            );
            expect(screen.getByText('Ask AI to apply').closest('button')).toBeDisabled();
        });

        it('is disabled while isSaving, showing a spinner', async () => {
            const user = userEvent.setup();
            render(
                <DesignDesigner
                    designSystems={[systemA, systemB]}
                    currentSystemId={1}
                    currentAccent={null}
                    onApply={onApply}
                    isSaving={true}
                />
            );
            await user.click(screen.getByText('Mono').closest('button') as HTMLElement);
            const button = screen.getByText('Ask AI to apply').closest('button') as HTMLElement;
            expect(button).toBeDisabled();
            expect(button.querySelector('.animate-spin')).toBeInTheDocument();
        });

        it('is disabled while isBuilding, with an explanatory title', async () => {
            const user = userEvent.setup();
            render(
                <DesignDesigner
                    designSystems={[systemA, systemB]}
                    currentSystemId={1}
                    currentAccent={null}
                    onApply={onApply}
                    isSaving={false}
                    isBuilding={true}
                />
            );
            await user.click(screen.getByText('Mono').closest('button') as HTMLElement);
            const button = screen.getByText('Ask AI to apply').closest('button') as HTMLElement;
            expect(button).toBeDisabled();
            expect(button).toHaveAttribute('title', 'A build is already running. Please wait.');
        });

        it('is disabled for an Automatic project with no selection made', () => {
            render(
                <DesignDesigner
                    designSystems={[systemA, systemB]}
                    currentSystemId={null}
                    currentAccent={null}
                    onApply={onApply}
                    isSaving={false}
                />
            );
            expect(screen.getByText('Ask AI to apply').closest('button')).toBeDisabled();
        });

        it('is enabled when a pending change exists and nothing is in-flight', async () => {
            const user = userEvent.setup();
            render(
                <DesignDesigner
                    designSystems={[systemA, systemB]}
                    currentSystemId={1}
                    currentAccent={null}
                    onApply={onApply}
                    isSaving={false}
                    isBuilding={false}
                />
            );
            await user.click(screen.getByText('Mono').closest('button') as HTMLElement);
            expect(screen.getByText('Ask AI to apply').closest('button')).toBeEnabled();
        });
    });

    it('calls onApply with the selected system id and accent when clicked', async () => {
        const user = userEvent.setup();
        render(
            <DesignDesigner
                designSystems={[systemA, systemB]}
                currentSystemId={1}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        await user.click(screen.getByText('Mono').closest('button') as HTMLElement);
        await user.click(screen.getByText('Ask AI to apply'));

        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onApply).toHaveBeenCalledWith(2, null);
    });

    it('shows a Preview button only for systems with has_preview, and opens the modal', async () => {
        const user = userEvent.setup();
        render(
            <DesignDesigner
                designSystems={[systemA, systemB]}
                currentSystemId={1}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );

        expect(within(cardFor('Substrate')).getByText('Preview')).toBeInTheDocument();
        expect(within(cardFor('Mono')).queryByText('Preview')).not.toBeInTheDocument();

        expect(screen.queryByTestId('preview-modal')).not.toBeInTheDocument();
        await user.click(within(cardFor('Substrate')).getByText('Preview'));

        const modal = screen.getByTestId('preview-modal');
        expect(modal).toHaveAttribute('data-slug', 'substrate');
    });

    it('renders no highlighted card and Apply disabled for an Automatic project', () => {
        render(
            <DesignDesigner
                designSystems={[systemA, systemB]}
                currentSystemId={null}
                currentAccent={null}
                onApply={onApply}
                isSaving={false}
            />
        );
        expect(hasClass(cardFor('Substrate'), 'border-primary')).toBe(false);
        expect(hasClass(cardFor('Mono'), 'border-primary')).toBe(false);
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
        expect(screen.getByText('Ask AI to apply').closest('button')).toBeDisabled();
    });
});
