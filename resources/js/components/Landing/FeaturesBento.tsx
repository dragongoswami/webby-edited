import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslatedFeatures, getIconComponent } from './data';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';
import type { PluginCapabilityStates } from '@/lib/planFeatures';

interface FeatureItem {
    title: string;
    description: string;
    icon: string;
    size?: 'large' | 'medium' | 'small';
    image_url?: string | null;
    plugin_slug?: string | null;
}

interface FeaturesBentoProps {
    content?: Record<string, unknown>;
    items?: FeatureItem[];
    settings?: Record<string, unknown>;
    pluginCapabilities?: PluginCapabilityStates;
}

const PLUGIN_CAP_MAP: Record<string, keyof PluginCapabilityStates> = {
    wordpress: 'wordpress',
    shopify: 'shopify',
    github: 'github',
    webagent: 'webAgent',
};

function isFeatureVisible(pluginSlug: string | null | undefined, caps?: PluginCapabilityStates): boolean {
    if (!pluginSlug) return true;
    const capKey = PLUGIN_CAP_MAP[pluginSlug];
    if (!capKey) return true;
    return Boolean(caps?.[capKey]);
}

export function FeaturesBento({ content, items, settings: _settings, pluginCapabilities }: FeaturesBentoProps = {}) {
    const { t } = useTranslation();

    // Use database items if provided, otherwise fall back to translated defaults
    const allFeatures = items?.length
        ? items.map((item, index) => ({
              id: index + 1,
              title: item.title,
              description: item.description,
              icon: getIconComponent(item.icon),
              size: item.size || 'small',
              image_url: item.image_url || null,
              plugin_slug: item.plugin_slug ?? null,
          }))
        : getTranslatedFeatures(t);

    const features = allFeatures.filter((f) =>
        isFeatureVisible((f as { plugin_slug?: string | null }).plugin_slug, pluginCapabilities)
    );

    // Get content with defaults - DB content takes priority
    const title = (content?.title as string) || t('Everything you need to build');
    const subtitle = (content?.subtitle as string) || t("From idea to deployment, we've got you covered with powerful features designed for modern development.");

    // Keep the bento a gapless rectangle for any card count (plugin gating can
    // change how many are shown). Tiles are a uniform height; large/medium span
    // two columns, small spans one. We sum the columns the visible tiles use and
    // widen the LAST tile to fill whatever the final row is short — so the grid
    // always ends flush instead of leaving holes on the right.
    const LG_COLS = 4;
    const tileWidth = (size?: string) => (size === 'large' || size === 'medium' ? 2 : 1);
    const usedColumns = features.reduce((sum, f) => sum + tileWidth(f.size), 0);
    const remainder = usedColumns % LG_COLS;
    const trailingFill = remainder === 0 ? 0 : LG_COLS - remainder;
    const lastIndex = features.length - 1;
    const lastTileSpan = tileWidth(features[lastIndex]?.size) + trailingFill;
    // Static literals so Tailwind's JIT keeps these classes in the build.
    const LG_SPAN: Record<number, string> = {
        1: 'lg:col-span-1',
        2: 'lg:col-span-2',
        3: 'lg:col-span-3',
        4: 'lg:col-span-4',
    };

    return (
        <section id="features" className="py-16 lg:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tighter mb-4">
                        {title}
                    </h2>
                    <p className="text-lg text-muted-foreground/90 max-w-2xl mx-auto leading-relaxed">
                        {subtitle}
                    </p>
                </div>

                {/* Bento Grid — dense auto-flow backfills the gaps left by the
                    larger tiles, and equal-height rows + full-height cards keep
                    the whole grid tightly packed and square, whatever the count
                    (plugin gating can change how many cards are shown). */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 md:auto-rows-fr grid-flow-row-dense gap-4">
                    {features.map((feature, index) => {
                        const Icon = feature.icon;
                        const isLast = index === lastIndex;
                        const lgSpanClass = isLast
                            ? LG_SPAN[lastTileSpan]
                            : tileWidth(feature.size) === 2
                              ? 'lg:col-span-2'
                              : 'lg:col-span-1';
                        return (
                            <Card
                                key={feature.id}
                                className={cn(
                                    'group flex h-full flex-col shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1',
                                    (feature.size === 'large' || feature.size === 'medium') && 'md:col-span-2',
                                    lgSpanClass
                                )}
                            >
                                <CardHeader
                                    className={cn(
                                        feature.size === 'large' && 'pb-0'
                                    )}
                                >
                                    {feature.image_url ? (
                                        <div className="mb-4 rounded-lg overflow-hidden">
                                            <img
                                                src={feature.image_url}
                                                alt={feature.title}
                                                className={cn(
                                                    'w-full h-auto object-cover',
                                                    feature.size === 'large' && 'max-h-48',
                                                    feature.size === 'medium' && 'max-h-32',
                                                    feature.size === 'small' && 'max-h-24'
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <div
                                            className={cn(
                                                'w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors',
                                                feature.size === 'large' && 'w-16 h-16'
                                            )}
                                        >
                                            <Icon
                                                className={cn(
                                                    'w-6 h-6 text-primary',
                                                    feature.size === 'large' && 'w-8 h-8'
                                                )}
                                            />
                                        </div>
                                    )}
                                    <CardTitle
                                        className={cn(
                                            'text-lg',
                                            feature.size === 'large' && 'text-2xl'
                                        )}
                                    >
                                        {feature.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription
                                        className={cn(
                                            'text-sm',
                                            feature.size === 'large' && 'text-base'
                                        )}
                                    >
                                        {feature.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
