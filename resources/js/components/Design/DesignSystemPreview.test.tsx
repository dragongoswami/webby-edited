/**
 * Tests for the design-system preview surfaces: the scaled thumbnail iframe and
 * the full-size preview modal. The Ziggy route() global and the translation hook
 * are stubbed by the test setup / inline mocks.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (s: string) => s }),
}));

import { DesignSystemThumbnail } from './DesignSystemThumbnail';
import { DesignSystemPreviewModal } from './DesignSystemPreviewModal';

describe('DesignSystemThumbnail', () => {
    it('renders a sandboxed, non-interactive preview iframe when a preview exists', () => {
        render(<DesignSystemThumbnail slug="substrate" name="Substrate" hasPreview />);
        const iframe = screen.getByTitle('Preview of :name') as HTMLIFrameElement;
        expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe.getAttribute('aria-hidden')).toBe('true');
        expect(iframe.getAttribute('src')).toContain('design-systems.preview');
    });

    it('shows a fallback icon (no iframe) when the system has no preview', () => {
        render(<DesignSystemThumbnail slug="aperture" name="Aperture" hasPreview={false} />);
        expect(screen.queryByTitle('Preview of :name')).toBeNull();
    });

    it('appends ?accent= to the iframe src when an accent is supplied', () => {
        render(<DesignSystemThumbnail slug="substrate" name="Substrate" hasPreview accent="indigo" />);
        const iframe = screen.getByTitle('Preview of :name') as HTMLIFrameElement;
        expect(iframe.src).toContain('accent=indigo');
    });

    it('omits ?accent= from the iframe src when accent is null', () => {
        render(<DesignSystemThumbnail slug="substrate" name="Substrate" hasPreview accent={null} />);
        const iframe = screen.getByTitle('Preview of :name') as HTMLIFrameElement;
        expect(iframe.src).not.toContain('accent=');
    });
});

describe('DesignSystemPreviewModal', () => {
    it('renders the full preview iframe pointed at the preview route when open', () => {
        render(<DesignSystemPreviewModal slug="substrate" name="Substrate" open onOpenChange={() => {}} />);
        const iframe = screen.getByTitle('Preview of :name') as HTMLIFrameElement;
        expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe.getAttribute('src')).toContain('design-systems.preview');
    });

    it('does not render iframe content when closed', () => {
        render(<DesignSystemPreviewModal slug="substrate" name="Substrate" open={false} onOpenChange={() => {}} />);
        expect(screen.queryByTitle('Preview of :name')).toBeNull();
    });

    it('appends ?accent= to the iframe src when an accent is supplied', () => {
        render(<DesignSystemPreviewModal slug="substrate" name="Substrate" accent="emerald" open onOpenChange={() => {}} />);
        const iframe = screen.getByTitle('Preview of :name') as HTMLIFrameElement;
        expect(iframe.src).toContain('accent=emerald');
    });
});
