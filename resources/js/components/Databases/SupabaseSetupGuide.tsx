import { useState, useEffect, useCallback } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { HelpCircle, ExternalLink, Maximize2, X } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface GuideStep {
    image: string;
    title: string;
    body: string;
}

const IMAGE_BASE = '/images/guides/supabase';

/**
 * In-app, step-by-step guide that walks a user through creating a Supabase
 * project in the Supabase dashboard and collecting the five values the
 * "Add Connection" form needs. Screenshots are annotated and locale-neutral;
 * all prose flows through the translation system. Each screenshot can be
 * opened full-size in a lightbox.
 */
export function SupabaseSetupGuide() {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [zoom, setZoom] = useState<GuideStep | null>(null);

    const steps: GuideStep[] = [
        {
            image: 'step-1-create-project.png',
            title: t('Create a Supabase project'),
            body: t(
                'In your Supabase dashboard, click New project. Give it a name, set a strong Database password — you will need it again in step 4, so save it somewhere safe — pick the region closest to your users, then click Create new project. It takes about a minute to provision.',
            ),
        },
        {
            image: 'step-2-project-url.png',
            title: t('Copy the Project URL'),
            body: t(
                'Open your project home page. Copy the project URL (it looks like https://xxxx.supabase.co) and paste it into the Supabase URL field.',
            ),
        },
        {
            image: 'step-3-api-keys.png',
            title: t('Copy the API keys'),
            body: t(
                'Go to Project Settings → API Keys. Copy the Publishable key into Publishable Key. Then Reveal and copy the Secret key into Secret Key — keep this one private, it grants full access.',
            ),
        },
        {
            image: 'step-4-connection-string.png',
            title: t('Copy the connection string'),
            body: t(
                'Click Connect at the top, choose Session pooler (it works on IPv4 networks for free) and the URI type. Copy the connection string into DB Connection String, then replace [YOUR-PASSWORD] with the database password you set in step 1.',
            ),
        },
    ];

    // Close the lightbox on Escape without also closing the Sheet.
    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && zoom) {
                e.preventDefault();
                e.stopPropagation();
                setZoom(null);
            }
        },
        [zoom],
    );

    useEffect(() => {
        if (!zoom) return;
        document.addEventListener('keydown', onKeyDown, true);
        return () => document.removeEventListener('keydown', onKeyDown, true);
    }, [zoom, onKeyDown]);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-center gap-2 border-primary/40 text-primary hover:bg-primary/5 hover:text-primary"
                >
                    <HelpCircle className="h-4 w-4" />
                    {t('How do I get these values?')}
                </Button>
            </SheetTrigger>

            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
            >
                <SheetHeader className="shrink-0 space-y-1 border-b p-6">
                    <SheetTitle>{t('Set up a Supabase database')}</SheetTitle>
                    <SheetDescription>
                        {t(
                            'Follow these steps in your Supabase dashboard, then copy each value into the form. Supabase has a free plan — no credit card required.',
                        )}
                    </SheetDescription>
                </SheetHeader>

                {/* Styled scrollbar; min-h-0 lets the flex child shrink so it scrolls */}
                <ScrollArea className="min-h-0 flex-1">
                    <ol className="space-y-8 p-6">
                        {steps.map((step, index) => (
                            <li key={step.image} className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                                        {index + 1}
                                    </span>
                                    <h3 className="text-base font-semibold text-foreground">
                                        {step.title}
                                    </h3>
                                </div>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {step.body}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setZoom(step)}
                                    className="group relative block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted shadow-sm transition hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                    aria-label={t('View full size')}
                                >
                                    <img
                                        src={`${IMAGE_BASE}/${step.image}`}
                                        alt={step.title}
                                        loading="lazy"
                                        className="w-full"
                                    />
                                    <span className="absolute end-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                                        <Maximize2 className="h-3 w-3" />
                                        {t('View full size')}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ol>

                    <div className="border-t p-6">
                        <p className="text-sm text-muted-foreground">
                            {t(
                                'Once all five values are filled in, save the connection and use Test Connection to confirm it works.',
                            )}
                        </p>
                        <a
                            href="https://supabase.com/dashboard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                        >
                            {t('Open the Supabase dashboard')}
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                </ScrollArea>

                {/* Lightbox */}
                {zoom && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={zoom.title}
                        onClick={() => setZoom(null)}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8"
                    >
                        <button
                            type="button"
                            onClick={() => setZoom(null)}
                            aria-label={t('Close')}
                            className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <figure
                            className="flex max-h-full max-w-full flex-col items-center gap-3"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={`${IMAGE_BASE}/${zoom.image}`}
                                alt={zoom.title}
                                className="max-h-[82vh] max-w-full rounded-lg border border-white/10 object-contain shadow-2xl"
                            />
                            <figcaption className="text-center text-sm text-white/80">
                                {zoom.title}
                            </figcaption>
                        </figure>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
