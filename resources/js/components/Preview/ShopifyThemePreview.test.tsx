import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShopifyThemePreview } from './ShopifyThemePreview';

vi.mock('@/contexts/LanguageContext', () => ({
    useTranslation: () => ({ t: (s: string) => s }),
}));

/**
 * Shopify themes are never previewed in-editor (Shopify blocks iframe embedding
 * with X-Frame-Options: DENY / frame-ancestors 'none', and there's no faithful
 * in-browser Liquid renderer). The panel only offers the real paths: open the
 * pushed theme's preview in the store (new tab) and download the theme zip.
 */
describe('ShopifyThemePreview', () => {
    it('never renders a preview iframe', () => {
        render(
            <ShopifyThemePreview
                projectId="p1"
                projectName="X"
                hasBuild={true}
                storeDomain="demo.myshopify.com"
                themeId="gid://shopify/OnlineStoreTheme/9"
            />,
        );
        expect(document.querySelector('iframe')).toBeNull();
    });

    it('shows the store preview link only when a theme id + domain exist', () => {
        const { rerender } = render(
            <ShopifyThemePreview projectId="p1" projectName="X" hasBuild={true} canConnectStore={true} />,
        );
        expect(screen.queryByText(/Open store preview/i)).toBeNull();

        rerender(
            <ShopifyThemePreview
                projectId="p1"
                projectName="X"
                hasBuild={true}
                storeDomain="demo.myshopify.com"
                themeId="gid://shopify/OnlineStoreTheme/9"
            />,
        );
        const link = screen.getByText(/Open store preview/i);
        expect(link.closest('a')!.getAttribute('href')).toBe(
            'https://demo.myshopify.com/?preview_theme_id=9',
        );
    });

    it('does not show the store link when only domain is set (no themeId)', () => {
        render(
            <ShopifyThemePreview
                projectId="p1"
                projectName="X"
                hasBuild={true}
                storeDomain="demo.myshopify.com"
            />,
        );
        expect(screen.getByText('Your Shopify theme is ready.')).toBeTruthy();
        expect(screen.queryByText(/Open store preview/i)).toBeNull();
    });

    it('offers a download link to the theme zip once built', () => {
        render(<ShopifyThemePreview projectId="abc" projectName="X" hasBuild={true} canConnectStore={true} />);
        const dl = screen.getByText(/Download theme/i).closest('a')!;
        expect(dl.getAttribute('href')).toBe('/preview/abc/shopify-theme.zip');
    });

    it('shows "ready" copy when hasBuild is true', () => {
        render(<ShopifyThemePreview projectId="p1" projectName="X" hasBuild={true} canConnectStore={true} />);
        expect(screen.getByText('Your Shopify theme is ready.')).toBeTruthy();
    });

    it('does not invite connecting a store when store connections are disabled (download-only)', () => {
        render(<ShopifyThemePreview projectId="p1" projectName="X" hasBuild={true} canConnectStore={false} />);
        expect(screen.queryByText(/Connect a Shopify store to preview/i)).toBeNull();
        expect(
            screen.getByText('Download the theme to install it manually in your Shopify admin.'),
        ).toBeTruthy();
    });

    it('invites connecting a store when store connections are enabled but none attached', () => {
        render(<ShopifyThemePreview projectId="p1" projectName="X" hasBuild={true} canConnectStore={true} />);
        expect(screen.getByText(/Connect a Shopify store to preview/i)).toBeTruthy();
    });

    it('keeps the store preview link for an existing push even if connections are now disabled', () => {
        // Stale connection: a theme was pushed while connections were enabled,
        // then the operator turned enable_store_connections off. The existing
        // push is still valid, so branch 1 (preview link) must still win.
        render(
            <ShopifyThemePreview
                projectId="p1"
                projectName="X"
                hasBuild={true}
                storeDomain="demo.myshopify.com"
                themeId="gid://shopify/OnlineStoreTheme/9"
                canConnectStore={false}
            />,
        );
        expect(screen.getByText(/Open store preview/i)).toBeTruthy();
        expect(screen.getByText(/cannot be embedded here/i)).toBeTruthy();
        expect(screen.queryByText(/Connect a Shopify store to preview/i)).toBeNull();
    });

    it('shows "build first" copy and no actions when hasBuild is false', () => {
        render(<ShopifyThemePreview projectId="p1" projectName="X" hasBuild={false} />);
        expect(screen.getByText('Build your theme to preview and download it.')).toBeTruthy();
        expect(screen.queryByText(/Download theme/i)).toBeNull();
        expect(screen.queryByText(/Open store preview/i)).toBeNull();
    });
});
