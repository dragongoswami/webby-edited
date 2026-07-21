import { Head } from '@inertiajs/react';
import { WordPressPlaygroundPreview } from '@/components/Preview/WordPressPlaygroundPreview';

interface WordPressPreviewProps {
    projectName: string;
    /** Same-origin URL of the generated theme zip (carries the session cookie). */
    themeZipUrl: string;
}

/**
 * Standalone full-page WordPress Playground preview, opened in a new tab from
 * the editor's "Open" button. Boots a real in-browser WordPress and installs
 * the generated theme. Same-origin so the theme-zip fetch is authenticated.
 */
export default function WordPressPreview({ projectName, themeZipUrl }: WordPressPreviewProps) {
    return (
        <>
            <Head title={projectName} />
            <div className="h-dvh w-full overflow-hidden pt-[var(--impersonation-banner-height,0px)]">
                <WordPressPlaygroundPreview themeZipUrl={themeZipUrl} />
            </div>
        </>
    );
}
