import { Rocket, ExternalLink, X } from 'lucide-react';

interface DemoPurchaseBarProps {
    /** CodeCanyon item URL to purchase the script. */
    href: string;
    /** Hide the bar for the current session. */
    onDismiss: () => void;
}

/**
 * Demo-mode announcement bar inviting visitors to buy the script on CodeCanyon.
 * Pinned above the Navbar (z-[60] sits above the navbar's z-50). Only rendered
 * in demo mode by Landing.tsx. Copy is intentionally English-only (demo flows
 * are not localized) and brand-agnostic (white-label safe).
 */
export function DemoPurchaseBar({ href, onDismiss }: DemoPurchaseBarProps) {
    return (
        <div className="fixed inset-x-0 top-0 z-[60] h-10 bg-gradient-to-r from-[#82b541] to-emerald-600 text-white shadow-sm">
            <div className="relative mx-auto flex h-full max-w-7xl items-center justify-center gap-2 px-10 sm:gap-3">
                <Rocket className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
                <p className="truncate text-xs font-medium sm:text-sm">
                    <span className="hidden sm:inline">
                        You&rsquo;re viewing a live demo &mdash; get the full source code on CodeCanyon
                    </span>
                    <span className="sm:hidden">Live demo &mdash; get the source code</span>
                </p>
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    aria-label="Buy on CodeCanyon (opens in new tab)"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-white/90"
                >
                    Buy now
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss demo notice"
                    className="absolute end-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
