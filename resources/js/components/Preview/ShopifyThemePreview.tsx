import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { Download, ExternalLink, ShoppingBag } from 'lucide-react';

interface Props {
    projectId: string;
    projectName: string;
    storeDomain?: string | null;
    /** GID of the pushed theme, e.g. "gid://shopify/OnlineStoreTheme/9" */
    themeId?: string | null;
    hasBuild: boolean;
    /**
     * Whether the store-connection surface is available (operator enabled
     * `enable_store_connections` + plan allows). When false the plugin runs
     * download-only — there is no way to connect a store, so the panel must
     * not invite the user to do so.
     */
    canConnectStore?: boolean;
}

/**
 * Preview panel for Shopify theme projects.
 *
 * Shopify themes are NOT previewed in-editor: Shopify serves its storefront with
 * `X-Frame-Options: DENY` + `frame-ancestors 'none'`, so the real store preview
 * cannot be embedded in an iframe, and there is no faithful in-browser renderer
 * for a Liquid theme. So this panel offers the two real paths instead: open the
 * pushed theme's preview in the connected store (new tab), and download the
 * theme zip to install in Shopify Admin.
 */
export function ShopifyThemePreview({ projectId, storeDomain, themeId, hasBuild, canConnectStore = false }: Props) {
    const { t } = useTranslation();

    // GIDs look like "gid://shopify/OnlineStoreTheme/123" — extract numeric part.
    const numeric = themeId ? themeId.replace(/.*\//, '') : null;
    const previewUrl =
        storeDomain && numeric ? `https://${storeDomain}/?preview_theme_id=${numeric}` : null;

    return (
        <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden p-8 text-center">
            {/* Shared app backdrop (warm gradient orbs + subtle grid), matching the
                website preview's empty state (InspectPreview) and the Create page —
                so the empty panel reads as a finished surface, not a blank void. */}
            <GradientBackground />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ShoppingBag className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="relative max-w-sm space-y-1">
                <p className="text-sm font-medium text-foreground">
                    {hasBuild
                        ? t('Your Shopify theme is ready.')
                        : t('Build your theme to preview and download it.')}
                </p>
                {hasBuild && (
                    <p className="text-xs text-muted-foreground">
                        {previewUrl
                            ? t('Shopify storefronts cannot be embedded here. Open the preview in your store, or download the theme to install it.')
                            : canConnectStore
                              ? t('Connect a Shopify store to preview the theme in your storefront, or download it to install manually.')
                              : t('Download the theme to install it manually in your Shopify admin.')}
                    </p>
                )}
            </div>
            {hasBuild && (
                <div className="relative flex flex-wrap items-center justify-center gap-3">
                    {previewUrl && (
                        <Button asChild size="sm">
                            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 me-2" />
                                {t('Open store preview')}
                            </a>
                        </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                        <a href={`/preview/${projectId}/shopify-theme.zip`}>
                            <Download className="h-4 w-4 me-2" />
                            {t('Download theme (.zip)')}
                        </a>
                    </Button>
                </div>
            )}
        </div>
    );
}

export default ShopifyThemePreview;
