import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Palette } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

/** Virtual viewport width the preview is rendered at before being scaled down. */
const VIRTUAL_WIDTH = 1280;

interface DesignSystemThumbnailProps {
    slug: string;
    name: string;
    /** Whether the system bundles a preview; when false a fallback icon shows. */
    hasPreview?: boolean;
    /** Accent to theme the preview with (null/undefined = the system's default). */
    accent?: string | null;
    /** Width : height ratio of the thumbnail box. Defaults to 16/10. */
    aspect?: number;
    className?: string;
}

/**
 * A lightweight, non-interactive preview of a design system: the same standalone
 * styleguide that the full preview modal shows, rendered into a sandboxed iframe
 * at a fixed virtual width and scaled down to fit the box. Lazy-loaded and
 * pointer-inert so it reads as an image, not an interactive frame.
 */
export function DesignSystemThumbnail({
    slug,
    name,
    hasPreview = true,
    accent = null,
    aspect = 16 / 10,
    className,
}: DesignSystemThumbnailProps) {
    const { t } = useTranslation();
    const boxRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);

    useEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const update = () => setScale(el.clientWidth / VIRTUAL_WIDTH);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div
            ref={boxRef}
            className={cn('relative overflow-hidden rounded-md border border-border/60 bg-muted', className)}
            style={{ aspectRatio: String(aspect) }}
        >
            {hasPreview ? (
                <iframe
                    key={accent ?? 'default'}
                    src={route('design-systems.preview', slug) + (accent ? `?accent=${encodeURIComponent(accent)}` : '')}
                    title={t('Preview of :name', { name })}
                    loading="lazy"
                    tabIndex={-1}
                    aria-hidden="true"
                    sandbox="allow-scripts"
                    className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
                    style={{
                        width: VIRTUAL_WIDTH,
                        height: VIRTUAL_WIDTH / aspect,
                        transform: `scale(${scale})`,
                        // Hidden until measured so a 1280px frame never flashes.
                        visibility: scale > 0 ? 'visible' : 'hidden',
                    }}
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Palette className="h-6 w-6 text-muted-foreground" />
                </div>
            )}
        </div>
    );
}
