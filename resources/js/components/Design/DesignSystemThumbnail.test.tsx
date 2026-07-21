import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesignSystemThumbnail } from './DesignSystemThumbnail';

// The global route() helper is stubbed by the test setup to ignore params; replace
// it here with a spy so we can assert on the exact slug used.
const routeSpy = vi.fn((name: string, param: string) => `/design-systems/${param}/preview`);
(globalThis as unknown as { route: typeof routeSpy }).route = routeSpy;

describe('DesignSystemThumbnail', () => {
    beforeEach(() => {
        routeSpy.mockClear();
    });

    it('renders an iframe pointed at the preview route with no accent query when accent is unset', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" />);

        const iframe = container.querySelector('iframe') as HTMLIFrameElement;
        expect(iframe).toBeInTheDocument();
        expect(routeSpy).toHaveBeenCalledWith('design-systems.preview', 'substrate');
        expect(iframe.getAttribute('src')).toBe('/design-systems/substrate/preview');
        expect(iframe.getAttribute('title')).toBe('Preview of Substrate');
        expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
        expect(iframe.getAttribute('aria-hidden')).toBe('true');
        expect(iframe.tabIndex).toBe(-1);
        expect(iframe.className).toContain('pointer-events-none');
    });

    it('renders the Palette fallback icon and no iframe when hasPreview is false', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" hasPreview={false} />);

        expect(container.querySelector('iframe')).not.toBeInTheDocument();
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('appends an encoded accent query string when accent is set', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" accent="warm sand #1" />);

        const iframe = container.querySelector('iframe') as HTMLIFrameElement;
        expect(iframe.getAttribute('src')).toBe(
            '/design-systems/substrate/preview?accent=' + encodeURIComponent('warm sand #1'),
        );
        // Pin the exact encoding for a value with a space and a hash.
        expect(iframe.getAttribute('src')).toBe('/design-systems/substrate/preview?accent=warm%20sand%20%231');
    });

    it('omits the accent query string entirely when accent is null', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" accent={null} />);

        const iframe = container.querySelector('iframe') as HTMLIFrameElement;
        expect(iframe.getAttribute('src')).toBe('/design-systems/substrate/preview');
        expect(iframe.getAttribute('src')).not.toContain('?accent=');
    });

    it('uses a default 16/10 aspect ratio for the box and derives the iframe height from it', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" />);

        const box = container.firstElementChild as HTMLElement;
        expect(box.style.aspectRatio).toBe(String(16 / 10));

        const iframe = container.querySelector('iframe') as HTMLIFrameElement;
        expect(iframe.style.width).toBe('1280px');
        expect(iframe.style.height).toBe(String(1280 / (16 / 10)) + 'px');
    });

    it('derives box aspect ratio and iframe height from a custom aspect prop', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" aspect={4 / 3} />);

        const box = container.firstElementChild as HTMLElement;
        expect(box.style.aspectRatio).toBe(String(4 / 3));

        const iframe = container.querySelector('iframe') as HTMLIFrameElement;
        expect(iframe.style.height).toBe(String(1280 / (4 / 3)) + 'px');
    });

    it('passes className through to the outer box alongside the base classes', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" className="my-custom-class" />);

        const box = container.firstElementChild as HTMLElement;
        expect(box.className).toContain('my-custom-class');
        expect(box.className).toContain('relative');
        expect(box.className).toContain('overflow-hidden');
        expect(box.className).toContain('rounded-md');
    });

    it('keeps the iframe hidden until the box has been measured (initial scale of 0 in jsdom)', () => {
        const { container } = render(<DesignSystemThumbnail slug="substrate" name="Substrate" />);

        const iframe = container.querySelector('iframe') as HTMLIFrameElement;
        expect(iframe.style.visibility).toBe('hidden');
        expect(iframe.style.transform).toBe('scale(0)');
    });
});
