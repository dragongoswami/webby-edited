import { describe, it, expect } from 'vitest';
import { buildPlanFeatures, PlanFeatureSource } from '../planFeatures';

/** Deterministic test translator: interpolates :key placeholders from replacements. */
const t = (key: string, r?: Record<string, string | number>) =>
    r ? key.replace(/:(\w+)/g, (_, k) => String(r[k] ?? `:${k}`)) : key;

/** Minimal base plan — only the two required fields. */
const base: PlanFeatureSource = {
    max_projects: null,
    monthly_build_credits: 0,
};

// ---------------------------------------------------------------------------
// 1. formatCredits — exercised via the ':credits AI credits/month' item
// ---------------------------------------------------------------------------
describe('formatCredits — AI credits/month item name', () => {
    it('monthly_build_credits -1 → "Unlimited AI credits/month"', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: -1 }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('Unlimited AI credits/month');
    });

    it('2_000_000 → "2M AI credits/month"', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: 2_000_000 }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('2M AI credits/month');
    });

    it('exactly 1_000_000 → "1M AI credits/month"', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: 1_000_000 }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('1M AI credits/month');
    });

    it('5_000 → "5K AI credits/month"', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: 5_000 }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('5K AI credits/month');
    });

    it('exactly 1_000 → "1K AI credits/month"', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: 1_000 }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('1K AI credits/month');
    });

    it('500 → "500 AI credits/month"', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: 500 }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('500 AI credits/month');
    });

    it('null monthly_build_credits → treated as 0 → "0 AI credits/month"', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: null }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('0 AI credits/month');
    });

    it('999_999 → "1000K AI credits/month" (toFixed(0) rounds up at the K boundary)', () => {
        const items = buildPlanFeatures({ ...base, monthly_build_credits: 999_999 }, t);
        const item = items.find(i => i.name.includes('AI credits/month'));
        expect(item?.name).toBe('1000K AI credits/month');
    });
});

// ---------------------------------------------------------------------------
// 1b. one_time_credits — credits granted once, never refilled (BR-000084)
// ---------------------------------------------------------------------------
describe('credits item — one_time_credits flag', () => {
    const creditsItem = (plan: PlanFeatureSource) =>
        buildPlanFeatures(plan, t).find(i => i.name.includes('AI credits'));

    it('one_time_credits true → "5K AI credits (one-time)"', () => {
        const item = creditsItem({ ...base, monthly_build_credits: 5_000, one_time_credits: true });
        expect(item?.name).toBe('5K AI credits (one-time)');
    });

    it('one_time_credits true with full amount → "500 AI credits (one-time)"', () => {
        const item = creditsItem({ ...base, monthly_build_credits: 500, one_time_credits: true });
        expect(item?.name).toBe('500 AI credits (one-time)');
    });

    it('one_time_credits false → keeps "5K AI credits/month"', () => {
        const item = creditsItem({ ...base, monthly_build_credits: 5_000, one_time_credits: false });
        expect(item?.name).toBe('5K AI credits/month');
    });

    it('one_time_credits absent → keeps "5K AI credits/month"', () => {
        const item = creditsItem({ ...base, monthly_build_credits: 5_000 });
        expect(item?.name).toBe('5K AI credits/month');
    });

    it('unlimited (-1) ignores one_time_credits → "Unlimited AI credits/month"', () => {
        const item = creditsItem({ ...base, monthly_build_credits: -1, one_time_credits: true });
        expect(item?.name).toBe('Unlimited AI credits/month');
    });
});

// ---------------------------------------------------------------------------
// 2. Project limit item (always at index 0, always included:true)
// ---------------------------------------------------------------------------
describe('project limit item', () => {
    it('max_projects null → "Unlimited projects", included:true', () => {
        const items = buildPlanFeatures({ ...base, max_projects: null }, t);
        expect(items[0].name).toBe('Unlimited projects');
        expect(items[0].included).toBe(true);
    });

    it('max_projects 1 → "1 project" (singular), included:true', () => {
        const items = buildPlanFeatures({ ...base, max_projects: 1 }, t);
        expect(items[0].name).toBe('1 project');
        expect(items[0].included).toBe(true);
    });

    it('max_projects 5 → "5 projects" (plural), included:true', () => {
        const items = buildPlanFeatures({ ...base, max_projects: 5 }, t);
        expect(items[0].name).toBe('5 projects');
        expect(items[0].included).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 3. Own API key item — present only when allow_user_ai_api_key truthy
// ---------------------------------------------------------------------------
describe('own API key item', () => {
    it('allow_user_ai_api_key true → item present with included:true', () => {
        const items = buildPlanFeatures({ ...base, allow_user_ai_api_key: true }, t);
        const item = items.find(i => i.name === 'Use your own API key');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });

    it('allow_user_ai_api_key false → item absent entirely', () => {
        const items = buildPlanFeatures({ ...base, allow_user_ai_api_key: false }, t);
        expect(items.some(i => i.name === 'Use your own API key')).toBe(false);
    });

    it('allow_user_ai_api_key omitted → item absent entirely', () => {
        const items = buildPlanFeatures({ ...base }, t);
        expect(items.some(i => i.name === 'Use your own API key')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 4. Custom subdomains
// ---------------------------------------------------------------------------
describe('custom subdomains item', () => {
    it('enable_subdomains false → "Custom subdomains" included:false', () => {
        const items = buildPlanFeatures({ ...base, enable_subdomains: false }, t);
        const item = items.find(i => i.name === 'Custom subdomains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(false);
    });

    it('enable_subdomains omitted → "Custom subdomains" included:false', () => {
        const items = buildPlanFeatures({ ...base }, t);
        const item = items.find(i => i.name === 'Custom subdomains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(false);
    });

    it('enable_subdomains true, max_subdomains_per_user null → "Unlimited custom subdomains" included:true', () => {
        const items = buildPlanFeatures(
            { ...base, enable_subdomains: true, max_subdomains_per_user: null },
            t,
        );
        const item = items.find(i => i.name === 'Unlimited custom subdomains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });

    it('enable_subdomains true, max_subdomains_per_user 1 → "1 custom subdomain" included:true', () => {
        const items = buildPlanFeatures(
            { ...base, enable_subdomains: true, max_subdomains_per_user: 1 },
            t,
        );
        const item = items.find(i => i.name === '1 custom subdomain');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });

    it('enable_subdomains true, max_subdomains_per_user 3 → "3 custom subdomains" included:true', () => {
        const items = buildPlanFeatures(
            { ...base, enable_subdomains: true, max_subdomains_per_user: 3 },
            t,
        );
        const item = items.find(i => i.name === '3 custom subdomains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 5. Custom domains (mirror of subdomains)
// ---------------------------------------------------------------------------
describe('custom domains item', () => {
    it('enable_custom_domains false → "Custom domains" included:false', () => {
        const items = buildPlanFeatures({ ...base, enable_custom_domains: false }, t);
        const item = items.find(i => i.name === 'Custom domains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(false);
    });

    it('enable_custom_domains omitted → "Custom domains" included:false', () => {
        const items = buildPlanFeatures({ ...base }, t);
        const item = items.find(i => i.name === 'Custom domains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(false);
    });

    it('enable_custom_domains true, max_custom_domains_per_user null → "Unlimited custom domains" included:true', () => {
        const items = buildPlanFeatures(
            { ...base, enable_custom_domains: true, max_custom_domains_per_user: null },
            t,
        );
        const item = items.find(i => i.name === 'Unlimited custom domains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });

    it('enable_custom_domains true, max_custom_domains_per_user 1 → "1 custom domain" included:true', () => {
        const items = buildPlanFeatures(
            { ...base, enable_custom_domains: true, max_custom_domains_per_user: 1 },
            t,
        );
        const item = items.find(i => i.name === '1 custom domain');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });

    it('enable_custom_domains true, max_custom_domains_per_user 3 → "3 custom domains" included:true', () => {
        const items = buildPlanFeatures(
            { ...base, enable_custom_domains: true, max_custom_domains_per_user: 3 },
            t,
        );
        const item = items.find(i => i.name === '3 custom domains');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// 6. Private project visibility — always present
// ---------------------------------------------------------------------------
describe('private project visibility', () => {
    it('allow_private_visibility true → included:true', () => {
        const items = buildPlanFeatures({ ...base, allow_private_visibility: true }, t);
        const item = items.find(i => i.name === 'Private project visibility');
        expect(item).toBeDefined();
        expect(item?.included).toBe(true);
    });

    it('allow_private_visibility false → included:false', () => {
        const items = buildPlanFeatures({ ...base, allow_private_visibility: false }, t);
        const item = items.find(i => i.name === 'Private project visibility');
        expect(item).toBeDefined();
        expect(item?.included).toBe(false);
    });

    it('allow_private_visibility omitted → included:false (falsy coercion)', () => {
        const items = buildPlanFeatures({ ...base }, t);
        const item = items.find(i => i.name === 'Private project visibility');
        expect(item).toBeDefined();
        expect(item?.included).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 7. Always-shown capability flags
// ---------------------------------------------------------------------------
describe('always-shown capability flags', () => {
    it('all four flags present regardless of plugins object', () => {
        const items = buildPlanFeatures({ ...base }, t, {});
        expect(items.some(i => i.name === 'Database integration')).toBe(true);
        expect(items.some(i => i.name === 'Code export')).toBe(true);
        expect(items.some(i => i.name === 'API access')).toBe(true);
        expect(items.some(i => i.name === 'White Label')).toBe(true);
    });

    it('Database integration: included reflects enable_database', () => {
        expect(
            buildPlanFeatures({ ...base, enable_database: true }, t)
                .find(i => i.name === 'Database integration')?.included,
        ).toBe(true);
        expect(
            buildPlanFeatures({ ...base, enable_database: false }, t)
                .find(i => i.name === 'Database integration')?.included,
        ).toBe(false);
    });

    it('Code export: included reflects enable_code_export', () => {
        expect(
            buildPlanFeatures({ ...base, enable_code_export: true }, t)
                .find(i => i.name === 'Code export')?.included,
        ).toBe(true);
        expect(
            buildPlanFeatures({ ...base, enable_code_export: false }, t)
                .find(i => i.name === 'Code export')?.included,
        ).toBe(false);
    });

    it('API access: included reflects enable_api', () => {
        expect(
            buildPlanFeatures({ ...base, enable_api: true }, t)
                .find(i => i.name === 'API access')?.included,
        ).toBe(true);
        expect(
            buildPlanFeatures({ ...base, enable_api: false }, t)
                .find(i => i.name === 'API access')?.included,
        ).toBe(false);
    });

    it('White Label: included reflects enable_white_label', () => {
        expect(
            buildPlanFeatures({ ...base, enable_white_label: true }, t)
                .find(i => i.name === 'White Label')?.included,
        ).toBe(true);
        expect(
            buildPlanFeatures({ ...base, enable_white_label: false }, t)
                .find(i => i.name === 'White Label')?.included,
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 8. Plugin-gated items
// ---------------------------------------------------------------------------
describe('plugin-gated items', () => {
    it('no plugins → none of github/wordpress/shopify/webAgent items appear', () => {
        const items = buildPlanFeatures({ ...base }, t, {});
        expect(items.some(i => i.name === 'GitHub integration')).toBe(false);
        expect(items.some(i => i.name === 'WordPress themes')).toBe(false);
        expect(items.some(i => i.name === 'Shopify themes')).toBe(false);
        expect(items.some(i => i.name === 'Web Agent')).toBe(false);
    });

    it('plugin active but plan flag false → item present with included:false', () => {
        const items = buildPlanFeatures(
            {
                ...base,
                enable_github: false,
                enable_wordpress: false,
                enable_shopify: false,
                enable_web_agent: false,
            },
            t,
            { github: true, wordpress: true, shopify: true, webAgent: true },
        );
        expect(items.find(i => i.name === 'GitHub integration')?.included).toBe(false);
        expect(items.find(i => i.name === 'WordPress themes')?.included).toBe(false);
        expect(items.find(i => i.name === 'Shopify themes')?.included).toBe(false);
        expect(items.find(i => i.name === 'Web Agent')?.included).toBe(false);
    });

    it('plugin active + plan flag true → item present with included:true', () => {
        const items = buildPlanFeatures(
            {
                ...base,
                enable_github: true,
                enable_wordpress: true,
                enable_shopify: true,
                enable_web_agent: true,
            },
            t,
            { github: true, wordpress: true, shopify: true, webAgent: true },
        );
        expect(items.find(i => i.name === 'GitHub integration')?.included).toBe(true);
        expect(items.find(i => i.name === 'WordPress themes')?.included).toBe(true);
        expect(items.find(i => i.name === 'Shopify themes')?.included).toBe(true);
        expect(items.find(i => i.name === 'Web Agent')?.included).toBe(true);
    });

    it('only github plugin → only GitHub integration appears (not the others)', () => {
        const items = buildPlanFeatures({ ...base }, t, { github: true });
        expect(items.some(i => i.name === 'GitHub integration')).toBe(true);
        expect(items.some(i => i.name === 'WordPress themes')).toBe(false);
        expect(items.some(i => i.name === 'Shopify themes')).toBe(false);
        expect(items.some(i => i.name === 'Web Agent')).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 9. Marketing features (plan.features)
// ---------------------------------------------------------------------------
describe('marketing features (plan.features)', () => {
    it('omitted features → item count equals the fixed set (9 for base plan with no plugins)', () => {
        // base plan: projects + credits + subdomains + domains + private + db + code + api + white-label
        const items = buildPlanFeatures({ ...base }, t, {});
        expect(items).toHaveLength(9);
    });

    it('null features → no extra items appended', () => {
        const withNull = buildPlanFeatures({ ...base, features: null }, t, {});
        const withoutFeatures = buildPlanFeatures({ ...base }, t, {});
        expect(withNull).toHaveLength(withoutFeatures.length);
    });

    it('plain string array → each appended with included:true', () => {
        const items = buildPlanFeatures(
            { ...base, features: ['Priority support', 'Custom branding'] },
            t,
        );
        expect(items.find(i => i.name === 'Priority support')?.included).toBe(true);
        expect(items.find(i => i.name === 'Custom branding')?.included).toBe(true);
    });

    it('object with included:false → included:false honored', () => {
        const items = buildPlanFeatures(
            { ...base, features: [{ name: 'Legacy feature', included: false }] },
            t,
        );
        const item = items.find(i => i.name === 'Legacy feature');
        expect(item).toBeDefined();
        expect(item?.included).toBe(false);
    });

    it('whitespace-only string → skipped', () => {
        const items = buildPlanFeatures({ ...base, features: ['   '] }, t);
        expect(items.some(i => i.name === '   ')).toBe(false);
        expect(items.some(i => i.name?.trim() === '')).toBe(false);
    });

    it('empty string → skipped', () => {
        const items = buildPlanFeatures({ ...base, features: [''] }, t);
        expect(items.some(i => i.name === '')).toBe(false);
    });

    it('object with null name → skipped without throwing', () => {
        const items = buildPlanFeatures(
            {
                ...base,
                features: [{ name: null as unknown as string, included: true }],
            },
            t,
        );
        expect(items.some(i => i.name == null)).toBe(false);
    });

    it('mixed string + object array → both honored', () => {
        const items = buildPlanFeatures(
            {
                ...base,
                features: ['Plain feature', { name: 'Object feature', included: false }],
            },
            t,
        );
        expect(items.find(i => i.name === 'Plain feature')?.included).toBe(true);
        expect(items.find(i => i.name === 'Object feature')?.included).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// 10. Ordering sanity
// ---------------------------------------------------------------------------
describe('ordering', () => {
    it('first item is project-limit, second is AI-credits', () => {
        const items = buildPlanFeatures({ ...base }, t);
        expect(items[0].name).toBe('Unlimited projects');
        expect(items[1].name).toContain('AI credits/month');
    });

    it('marketing features come after all capability flags', () => {
        const items = buildPlanFeatures(
            { ...base, features: ['Custom Feature'] },
            t,
            { github: true },
        );
        const dbIdx = items.findIndex(i => i.name === 'Database integration');
        const ghIdx = items.findIndex(i => i.name === 'GitHub integration');
        const customIdx = items.findIndex(i => i.name === 'Custom Feature');
        expect(dbIdx).toBeGreaterThanOrEqual(0);
        expect(ghIdx).toBeGreaterThanOrEqual(0);
        expect(customIdx).toBeGreaterThan(dbIdx);
        expect(customIdx).toBeGreaterThan(ghIdx);
    });

    it('for a fully-enabled plan marketing features are the last items', () => {
        const items = buildPlanFeatures(
            {
                ...base,
                enable_database: true,
                enable_code_export: true,
                enable_api: true,
                enable_white_label: true,
                features: ['Marketing Feature A', 'Marketing Feature B'],
            },
            t,
            { github: true, wordpress: true, shopify: true, webAgent: true },
        );
        const lastTwo = items.slice(-2).map(i => i.name);
        expect(lastTwo).toEqual(['Marketing Feature A', 'Marketing Feature B']);
    });
});
