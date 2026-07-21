import { useEffect, useMemo, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import { useTranslation } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { DemoIframeBlocker } from '@/components/DemoIframeBlocker';
import { PageProps } from '@/types';
import type { PluginCapabilityStates } from '@/lib/planFeatures';
import {
    Navbar,
    DemoPurchaseBar,
    HeroSection,
    SocialProof,
    FeaturesBento,
    ProductShowcase,
    PricingSection,
    UseCases,
    CategoryGallery,
    TestimonialsSection,
    FAQSection,
    FinalCTA,
    Footer,
    AnimatedSection,
    ScrollToTop,
} from '@/components/Landing';

// Section data structure from the backend
interface SectionData {
    type: string;
    is_enabled: boolean;
    settings: Record<string, unknown>;
    content: Record<string, string | string[] | null>;
    items: Array<Record<string, unknown>>;
}

interface LandingProps extends PageProps {
    // Core props
    canLogin: boolean;
    canRegister: boolean;
    isPusherConfigured: boolean;
    canCreateProject?: boolean;
    cannotCreateReason?: string | null;
    isPreview?: boolean;

    // Plans
    plans?: Array<{
        id: number;
        name: string;
        slug: string;
        description: string | null;
        price: string;
        billing_period: 'monthly' | 'yearly' | 'lifetime';
        features: Array<{ name: string; included: boolean }>;
        is_popular: boolean;
        max_projects: number | null;
        monthly_build_credits: number;
        one_time_credits?: boolean;
        allow_user_ai_api_key: boolean;
        enable_subdomains?: boolean;
        max_subdomains_per_user?: number | null;
        allow_private_visibility?: boolean;
        enable_database?: boolean;
        enable_code_export?: boolean;
        enable_github?: boolean;
        enable_wordpress?: boolean;
        enable_shopify?: boolean;
        enable_web_agent?: boolean;
        enable_white_label?: boolean;
        // Read by buildPlanFeatures — keep in sync with Plan::PRICING_COLUMNS
        enable_api?: boolean;
    }>;

    // Plugin-gated capability availability (hides plugin features from pricing)
    pluginCapabilities?: PluginCapabilityStates;

    // Statistics
    statistics?: {
        usersCount?: number;
        projectsCount?: number;
        users?: number;
        projects?: number;
    };

    // Dynamic sections from database
    sections?: SectionData[];

    // Legacy props for backward compatibility
    suggestions?: string[];
    typingPrompts?: string[];
    headline?: string;
    subtitle?: string;
}

// Common props interface for section components
interface SectionComponentProps {
    content?: Record<string, unknown>;
    items?: Array<Record<string, unknown>>;
    settings?: Record<string, unknown>;
}

// Map section types to components
// Note: trusted_by is rendered inside HeroSection, not as a standalone section
// Note: 'features' is NOT listed here — it has an explicit `case 'features'` in renderSection
// so it can receive the pluginCapabilities prop. Adding it here would be dead code.
const SECTION_COMPONENTS: Record<string, React.ComponentType<SectionComponentProps>> = {
    product_showcase: ProductShowcase as React.ComponentType<SectionComponentProps>,
    use_cases: UseCases as React.ComponentType<SectionComponentProps>,
    categories: CategoryGallery as React.ComponentType<SectionComponentProps>,
    testimonials: TestimonialsSection as React.ComponentType<SectionComponentProps>,
    faq: FAQSection as React.ComponentType<SectionComponentProps>,
};

export default function Landing({
    auth,
    canLogin,
    canRegister,
    isPusherConfigured,
    canCreateProject = true,
    cannotCreateReason = null,
    isPreview = false,
    plans = [],
    pluginCapabilities,
    statistics,
    sections = [],
    // Legacy props
    suggestions,
    typingPrompts,
    headline,
    subtitle,
}: LandingProps) {
    const { t } = useTranslation();
    const pageProps = usePage<PageProps>().props;
    const { errors } = pageProps as { errors?: { prompt?: string } };
    const { appSettings, isDemo, isLocal } = pageProps;

    // "Buy on CodeCanyon" bar — shown in demo mode and in the local environment,
    // until dismissed for the session.
    const showBarEligible = Boolean(isDemo) || Boolean(isLocal);
    const [showDemoBar, setShowDemoBar] = useState(false);
    useEffect(() => {
        // Resolved in an effect (not initial state) to stay SSR-safe and avoid a
        // hydration mismatch — sessionStorage is only available client-side.
        if (showBarEligible && sessionStorage.getItem('demo_buy_bar_dismissed') !== '1') {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowDemoBar(true);
        }
    }, [showBarEligible]);
    const dismissDemoBar = () => {
        sessionStorage.setItem('demo_buy_bar_dismissed', '1');
        setShowDemoBar(false);
    };
    // Raise the anchor scroll offset while the bar occupies the top 40px so
    // in-page nav links still land below the (now lower) fixed navbar.
    useEffect(() => {
        if (!showDemoBar) return;
        const el = document.documentElement;
        el.style.scrollPaddingTop = '6.5rem';
        return () => {
            el.style.scrollPaddingTop = '';
        };
    }, [showDemoBar]);

    // Show toast when there are errors
    useEffect(() => {
        if (errors?.prompt) {
            toast.error(errors.prompt);
        }
    }, [errors]);

    // Extract content from specific sections
    const heroSection = useMemo(
        () => sections.find((s) => s.type === 'hero'),
        [sections]
    );
    const socialProofSection = useMemo(
        () => sections.find((s) => s.type === 'social_proof'),
        [sections]
    );
    const pricingSection = useMemo(
        () => sections.find((s) => s.type === 'pricing'),
        [sections]
    );
    const ctaSection = useMemo(
        () => sections.find((s) => s.type === 'cta'),
        [sections]
    );

    // Get hero content with legacy fallback
    const heroContent = heroSection?.content || {};
    const heroHeadlines = (heroContent.headlines as string[]) || (headline ? [headline] : []);
    const heroSubtitles = (heroContent.subtitles as string[]) || (subtitle ? [subtitle] : []);
    const heroTypingPrompts = (heroContent.typing_prompts as string[]) || typingPrompts || [];
    const heroSuggestions = (heroContent.suggestions as string[]) || suggestions || [];
    const heroCtaButton = (heroContent.cta_button as string) || t('Start Building');

    // Get social proof content
    const socialProofContent = socialProofSection?.content || {};

    // Get CTA content
    const ctaContent = ctaSection?.content || {};

    // Get enabled sections in their database order
    // Note: trusted_by is rendered inside HeroSection, so we filter it out here
    const enabledSections = useMemo(
        () => sections.filter((s) => s.is_enabled && s.type !== 'trusted_by'),
        [sections]
    );

    // Get enabled section types for navbar navigation
    const enabledSectionTypes = useMemo(
        () => enabledSections.map((s) => s.type),
        [enabledSections]
    );

    // Normalize statistics
    const normalizedStats = {
        usersCount: statistics?.usersCount ?? statistics?.users ?? 0,
        projectsCount: statistics?.projectsCount ?? statistics?.projects ?? 0,
    };

    // Render a section based on its type
    const renderSection = (section: SectionData, index: number) => {
        switch (section.type) {
            case 'hero':
                return (
                    <HeroSection
                        key={section.type}
                        auth={auth}
                        initialSuggestions={heroSuggestions}
                        initialTypingPrompts={heroTypingPrompts}
                        initialHeadline={heroHeadlines[0] || t('What will you build today?')}
                        initialSubtitle={heroSubtitles[0] || t('Create stunning websites by chatting with AI.')}
                        isPusherConfigured={isPusherConfigured}
                        canCreateProject={canCreateProject}
                        cannotCreateReason={cannotCreateReason}
                        content={{
                            headlines: heroHeadlines,
                            subtitles: heroSubtitles,
                            cta_button: heroCtaButton,
                        }}
                        trustedBy={{
                            enabled: heroSection?.settings?.show_trusted_by !== false,
                            content: { title: heroContent.trusted_by_title as string },
                            items: heroSection?.items || [],
                        }}
                    />
                );
            case 'social_proof':
                return (
                    <SocialProof
                        key={section.type}
                        statistics={normalizedStats}
                        content={socialProofContent}
                    />
                );
            case 'pricing':
                // Only render if plans exist
                if (plans.length === 0) return null;
                return (
                    <AnimatedSection key={section.type} delay={index * 50}>
                        <PricingSection
                            plans={plans}
                            content={pricingSection?.content}
                            pluginCapabilities={pluginCapabilities}
                        />
                    </AnimatedSection>
                );
            case 'cta':
                return (
                    <AnimatedSection key={section.type} delay={index * 50}>
                        <FinalCTA
                            auth={auth}
                            isPusherConfigured={isPusherConfigured}
                            canCreateProject={canCreateProject}
                            cannotCreateReason={cannotCreateReason}
                            content={ctaContent}
                        />
                    </AnimatedSection>
                );
            case 'features':
                return (
                    <AnimatedSection key={section.type} delay={index * 50}>
                        <FeaturesBento
                            content={section.content}
                            items={section.items as never}
                            settings={section.settings}
                            pluginCapabilities={pluginCapabilities}
                        />
                    </AnimatedSection>
                );
            default: {
                const Component = SECTION_COMPONENTS[section.type];
                if (!Component) return null;
                return (
                    <AnimatedSection key={section.type} delay={index * 50}>
                        <Component
                            content={section.content}
                            items={section.items}
                            settings={section.settings}
                        />
                    </AnimatedSection>
                );
            }
        }
    };

    return (
        <>
            <Head title={appSettings?.site_tagline || t("Build Websites with AI")} />
            <Toaster />
            {!isPreview && <DemoIframeBlocker />}
            {showDemoBar && (
                <DemoPurchaseBar
                    href="https://codecanyon.net/item/webby-aipowered-nocode-website-builder-saas-platform/61857601"
                    onDismiss={dismissDemoBar}
                />
            )}
            <Navbar auth={auth} canLogin={canLogin} canRegister={canRegister} enabledSectionTypes={enabledSectionTypes} announcementOffset={showDemoBar} />
            <main className={showDemoBar ? 'pt-10' : undefined}>
                {/* Render all sections in their database order */}
                {enabledSections.map((section, index) => renderSection(section, index))}
            </main>
            <Footer />
            <ScrollToTop />
        </>
    );
}
