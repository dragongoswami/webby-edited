/**
 * Single source of truth for a plan's pricing feature list.
 *
 * Both the authenticated billing page (`Billing/Plans.tsx`) and the public
 * landing pricing (`Landing/PricingSection.tsx`) build their feature lists from
 * this, so the two surfaces can never silently disagree. Lines are derived from
 * the plan's real limit/capability columns first, then the admin's custom
 * marketing features JSON (display-only) is appended.
 *
 * Whatever consumes this must ensure the plan payload actually carries these
 * columns (the landing `/` route selects an explicit subset — keep it in sync).
 */

export type PlanFeatureTranslate = (
    key: string,
    replacements?: Record<string, string | number>,
) => string;

export interface PlanFeatureItem {
    name: string;
    included: boolean;
}

/**
 * Which plugin-gated builder capabilities exist on this install. A capability
 * whose plugin is not installed/active is omitted from the feature list
 * entirely (not shown as a greyed-out "✗"). Database and code export are plain
 * plan flags, not plugins, so they are always shown. Mirrors
 * PluginManager::capabilityPluginStates().
 */
export interface PluginCapabilityStates {
    github?: boolean;
    wordpress?: boolean;
    shopify?: boolean;
    webAgent?: boolean;
}

/** Every plan field the feature list reads. All optional so any Plan shape fits. */
export interface PlanFeatureSource {
    max_projects: number | null;
    monthly_build_credits: number | null;
    /** When true, credits are granted once at activation and never refilled monthly. */
    one_time_credits?: boolean;
    allow_user_ai_api_key?: boolean;
    enable_subdomains?: boolean;
    max_subdomains_per_user?: number | null;
    enable_custom_domains?: boolean;
    max_custom_domains_per_user?: number | null;
    allow_private_visibility?: boolean;
    enable_database?: boolean;
    enable_code_export?: boolean;
    enable_github?: boolean;
    enable_wordpress?: boolean;
    enable_shopify?: boolean;
    enable_web_agent?: boolean;
    enable_white_label?: boolean;
    enable_api?: boolean;
    features?: (string | { name: string; included: boolean })[] | null;
}

function formatCredits(credits: number, t: PlanFeatureTranslate): string {
    if (credits === -1) return t('Unlimited');
    if (credits >= 1_000_000) return `${(credits / 1_000_000).toFixed(0)}M`;
    if (credits >= 1_000) return `${(credits / 1_000).toFixed(0)}K`;
    return credits.toString();
}

export function buildPlanFeatures(
    plan: PlanFeatureSource,
    t: PlanFeatureTranslate,
    plugins: PluginCapabilityStates = {},
): PlanFeatureItem[] {
    const items: PlanFeatureItem[] = [];

    // Project limit (always shown)
    items.push({
        name:
            plan.max_projects === null
                ? t('Unlimited projects')
                : plan.max_projects === 1
                  ? t(':count project', { count: 1 })
                  : t(':count projects', { count: plan.max_projects }),
        included: true,
    });

    // AI credits (always shown). A one-time plan grants credits once at
    // activation with no monthly refill, so it must not read "/month" — except
    // an unlimited allowance, where the one-time flag is meaningless.
    const credits = plan.monthly_build_credits ?? 0;
    items.push({
        name:
            plan.one_time_credits && credits !== -1
                ? t(':credits AI credits (one-time)', {
                      credits: formatCredits(credits, t),
                  })
                : t(':credits AI credits/month', {
                      credits: formatCredits(credits, t),
                  }),
        included: true,
    });

    // Own API key — shown only when allowed (it reads oddly as a greyed-out "no")
    if (plan.allow_user_ai_api_key) {
        items.push({ name: t('Use your own API key'), included: true });
    }

    // Custom subdomains — shown either way (✓ / greyed ✗)
    if (plan.enable_subdomains) {
        items.push({
            name:
                plan.max_subdomains_per_user == null
                    ? t('Unlimited custom subdomains')
                    : plan.max_subdomains_per_user === 1
                      ? t('1 custom subdomain')
                      : t(':count custom subdomains', {
                            count: plan.max_subdomains_per_user,
                        }),
            included: true,
        });
    } else {
        items.push({ name: t('Custom subdomains'), included: false });
    }

    // Custom domains — ✓ / greyed ✗
    if (plan.enable_custom_domains) {
        items.push({
            name:
                plan.max_custom_domains_per_user == null
                    ? t('Unlimited custom domains')
                    : plan.max_custom_domains_per_user === 1
                      ? t('1 custom domain')
                      : t(':count custom domains', {
                            count: plan.max_custom_domains_per_user,
                        }),
            included: true,
        });
    } else {
        items.push({ name: t('Custom domains'), included: false });
    }

    // Private project visibility — ✓ / greyed ✗
    items.push({
        name: t('Private project visibility'),
        included: !!plan.allow_private_visibility,
    });

    // Capability flags — derived from each plan's enable_* toggles, ✓ / greyed ✗.
    // Database and code export are plain plan flags → always listed. GitHub,
    // WordPress and Web Agent are plugin-gated → listed only when their plugin is
    // installed/active on this install, otherwise omitted entirely (advertising a
    // capability the install can't provide would be wrong).
    items.push({ name: t('Database integration'), included: !!plan.enable_database });
    items.push({ name: t('Code export'), included: !!plan.enable_code_export });
    items.push({ name: t('API access'), included: !!plan.enable_api });
    items.push({ name: t('White Label'), included: !!plan.enable_white_label });
    if (plugins.github) {
        items.push({ name: t('GitHub integration'), included: !!plan.enable_github });
    }
    if (plugins.wordpress) {
        items.push({ name: t('WordPress themes'), included: !!plan.enable_wordpress });
    }
    if (plugins.shopify) {
        items.push({ name: t('Shopify themes'), included: !!plan.enable_shopify });
    }
    if (plugins.webAgent) {
        items.push({ name: t('Web Agent'), included: !!plan.enable_web_agent });
    }

    // Admin-curated marketing features (display-only JSON), appended last.
    if (Array.isArray(plan.features)) {
        for (const feature of plan.features) {
            const name = typeof feature === 'object' && feature !== null ? feature.name : feature;
            const included =
                typeof feature === 'object' && feature !== null ? feature.included : true;
            if (!name?.trim()) continue;
            items.push({ name, included });
        }
    }

    return items;
}
