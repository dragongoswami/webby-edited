/**
 * A design system installed on the platform, as exposed to the Create + Settings
 * pickers (DesignSystemService::publicCatalog on the backend). The token bytes
 * and agent playbook are intentionally excluded — only metadata + accent names.
 */
export interface DesignSystemOption {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    is_default: boolean;
    /** Accent palette names selectable within this system (e.g. "indigo"). */
    accents: string[];
    /** Whether the system bundles a standalone styleguide preview (preview.html). */
    has_preview?: boolean;
}
