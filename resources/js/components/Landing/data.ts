import {
    Sparkles,
    Eye,
    Code,
    Download,
    LayoutTemplate,
    MessageSquare,
    Globe,
    Terminal,
    Rocket,
    Palette,
    Building,
    Layout,
    LayoutDashboard,
    ShoppingCart,
    Briefcase,
    Settings,
    Zap,
    Star,
    Users,
    HelpCircle,
    Database,
    Github,
    ShoppingBag,
    Newspaper,
    KeyRound,
    Mic,
    type LucideIcon,
} from 'lucide-react';

// Icon name to component mapping
export const ICON_MAP = {
    Sparkles,
    Eye,
    Code,
    Download,
    LayoutTemplate,
    MessageSquare,
    Globe,
    Terminal,
    Rocket,
    Palette,
    Building,
    Layout,
    LayoutDashboard,
    ShoppingCart,
    Briefcase,
    Settings,
    Zap,
    Star,
    Users,
    HelpCircle,
    Database,
    Github,
    ShoppingBag,
    Newspaper,
    KeyRound,
    Mic,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICON_MAP;

export const ICON_NAMES = Object.keys(ICON_MAP) as IconName[];

/**
 * Get a Lucide icon component by name.
 * Falls back to Sparkles if the icon is not found.
 */
export function getIconComponent(iconName: string): LucideIcon {
    return ICON_MAP[iconName as IconName] ?? Sparkles;
}

// Feature cards for bento grid
export interface Feature {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
    size: 'large' | 'medium' | 'small';
    image_url?: string | null;
    plugin_slug?: string | null;
}

export const features: Feature[] = [
    {
        id: 'ai-powered',
        title: 'AI-Powered Development',
        description: 'Describe what you want, and watch it come to life. Our AI understands context and builds complete applications.',
        icon: Sparkles,
        size: 'large',
    },
    {
        id: 'real-time',
        title: 'Real-time Preview',
        description: 'See your changes instantly as the AI builds your project. No waiting, no refreshing.',
        icon: Eye,
        size: 'medium',
    },
    {
        id: 'code-editor',
        title: 'Built-in Code Editor',
        description: 'Full Monaco editor with syntax highlighting, file tree, and code completion.',
        icon: Code,
        size: 'medium',
    },
    {
        id: 'export',
        title: 'Export & Deploy',
        description: 'Host on our platform or export your code to deploy anywhere.',
        icon: Download,
        size: 'small',
    },
    {
        id: 'templates',
        title: 'Smart Templates',
        description: 'Start with AI-selected templates that match your project needs perfectly.',
        icon: LayoutTemplate,
        size: 'small',
    },
    {
        id: 'iterations',
        title: 'Iterative Refinement',
        description: 'Keep chatting to refine and improve your creation until it\'s perfect.',
        icon: MessageSquare,
        size: 'small',
    },
    {
        id: 'custom-subdomains',
        title: 'Custom Subdomains',
        description: 'Publish your project to a custom subdomain and share it with the world.',
        icon: Globe,
        size: 'small',
    },
    {
        id: 'wordpress-themes',
        title: 'WordPress Themes',
        description: 'Generate installable WordPress block themes (FSE) from a prompt — no manual setup.',
        icon: Newspaper,
        size: 'medium',
        plugin_slug: 'wordpress',
    },
    {
        id: 'shopify-themes',
        title: 'Shopify Themes',
        description: 'Build Online Store 2.0 themes and push them straight to your Shopify store.',
        icon: ShoppingBag,
        size: 'medium',
        plugin_slug: 'shopify',
    },
    {
        id: 'github-sync',
        title: 'GitHub Sync',
        description: 'Auto-push your generated source to a private GitHub repo after every build.',
        icon: Github,
        size: 'small',
        plugin_slug: 'github',
    },
    {
        id: 'supabase-db',
        title: 'Connect Your Database',
        description: 'Bring your own Supabase project and let the AI generate auth and tables for your app.',
        icon: Database,
        size: 'small',
    },
    {
        id: 'design-systems',
        title: 'Design Systems',
        description: 'Swap a complete visual identity — colors, fonts, and tokens — without touching your layout.',
        icon: Palette,
        size: 'small',
    },
    {
        id: 'personal-api',
        title: 'Personal API',
        description: 'Access your account, projects, and usage programmatically with read-only API keys.',
        icon: KeyRound,
        size: 'small',
    },
    {
        id: 'voice-input',
        title: 'Voice Input',
        description: 'Describe your project hands-free with built-in, browser-native voice prompting.',
        icon: Mic,
        size: 'small',
    },
];

// User personas
export interface Persona {
    id: string;
    title: string;
    description: string;
    icon: LucideIcon;
}

export const personas: Persona[] = [
    {
        id: 'developers',
        title: 'Developers',
        description: 'Accelerate your workflow with AI-assisted development. Focus on logic while AI handles boilerplate.',
        icon: Terminal,
    },
    {
        id: 'entrepreneurs',
        title: 'Entrepreneurs',
        description: 'Launch your MVP faster. Go from idea to working prototype in minutes, not weeks.',
        icon: Rocket,
    },
    {
        id: 'designers',
        title: 'Designers',
        description: 'Bring your designs to life without writing code. Describe your vision and see it built.',
        icon: Palette,
    },
    {
        id: 'agencies',
        title: 'Agencies',
        description: 'Deliver more projects in less time. Scale your output without scaling your team.',
        icon: Building,
    },
];

// Project categories
export interface Category {
    name: string;
    icon: LucideIcon;
}

export const categories: Category[] = [
    { name: 'Landing Pages', icon: Layout },
    { name: 'Dashboards', icon: LayoutDashboard },
    { name: 'E-commerce', icon: ShoppingCart },
    { name: 'Portfolios', icon: Briefcase },
    { name: 'Web Apps', icon: Globe },
    { name: 'Admin Panels', icon: Settings },
];

// Translation function type
type TranslationFn = (key: string, replacements?: Record<string, string | number>) => string;

/**
 * Get translated features array.
 * Falls back to English if translation key returns the key itself.
 */
export function getTranslatedFeatures(t: TranslationFn): Feature[] {
    return [
        {
            id: 'ai-powered',
            title: t('AI-Powered Development'),
            description: t('Describe what you want, and watch it come to life. Our AI understands context and builds complete applications.'),
            icon: Sparkles,
            size: 'large',
        },
        {
            id: 'real-time',
            title: t('Real-time Preview'),
            description: t('See your changes instantly as the AI builds your project. No waiting, no refreshing.'),
            icon: Eye,
            size: 'medium',
        },
        {
            id: 'code-editor',
            title: t('Built-in Code Editor'),
            description: t('Full Monaco editor with syntax highlighting, file tree, and code completion.'),
            icon: Code,
            size: 'medium',
        },
        {
            id: 'export',
            title: t('Export & Deploy'),
            description: t('Host on our platform or export your code to deploy anywhere.'),
            icon: Download,
            size: 'small',
        },
        {
            id: 'templates',
            title: t('Smart Templates'),
            description: t('Start with AI-selected templates that match your project needs perfectly.'),
            icon: LayoutTemplate,
            size: 'small',
        },
        {
            id: 'iterations',
            title: t('Iterative Refinement'),
            description: t("Keep chatting to refine and improve your creation until it's perfect."),
            icon: MessageSquare,
            size: 'small',
        },
        {
            id: 'custom-subdomains',
            title: t('Custom Subdomains'),
            description: t('Publish your project to a custom subdomain and share it with the world.'),
            icon: Globe,
            size: 'small',
        },
        {
            id: 'wordpress-themes',
            title: t('WordPress Themes'),
            description: t('Generate installable WordPress block themes (FSE) from a prompt — no manual setup.'),
            icon: Newspaper,
            size: 'medium',
            plugin_slug: 'wordpress',
        },
        {
            id: 'shopify-themes',
            title: t('Shopify Themes'),
            description: t('Build Online Store 2.0 themes and push them straight to your Shopify store.'),
            icon: ShoppingBag,
            size: 'medium',
            plugin_slug: 'shopify',
        },
        {
            id: 'github-sync',
            title: t('GitHub Sync'),
            description: t('Auto-push your generated source to a private GitHub repo after every build.'),
            icon: Github,
            size: 'small',
            plugin_slug: 'github',
        },
        {
            id: 'supabase-db',
            title: t('Connect Your Database'),
            description: t('Bring your own Supabase project and let the AI generate auth and tables for your app.'),
            icon: Database,
            size: 'small',
        },
        {
            id: 'design-systems',
            title: t('Design Systems'),
            description: t('Swap a complete visual identity — colors, fonts, and tokens — without touching your layout.'),
            icon: Palette,
            size: 'small',
        },
        {
            id: 'personal-api',
            title: t('Personal API'),
            description: t('Access your account, projects, and usage programmatically with read-only API keys.'),
            icon: KeyRound,
            size: 'small',
        },
        {
            id: 'voice-input',
            title: t('Voice Input'),
            description: t('Describe your project hands-free with built-in, browser-native voice prompting.'),
            icon: Mic,
            size: 'small',
        },
    ];
}

/**
 * Get translated personas array.
 */
export function getTranslatedPersonas(t: TranslationFn): Persona[] {
    return [
        {
            id: 'developers',
            title: t('Developers'),
            description: t('Accelerate your workflow with AI-assisted development. Focus on logic while AI handles boilerplate.'),
            icon: Terminal,
        },
        {
            id: 'entrepreneurs',
            title: t('Entrepreneurs'),
            description: t('Launch your MVP faster. Go from idea to working prototype in minutes, not weeks.'),
            icon: Rocket,
        },
        {
            id: 'designers',
            title: t('Designers'),
            description: t('Bring your designs to life without writing code. Describe your vision and see it built.'),
            icon: Palette,
        },
        {
            id: 'agencies',
            title: t('Agencies'),
            description: t('Deliver more projects in less time. Scale your output without scaling your team.'),
            icon: Building,
        },
    ];
}

/**
 * Get translated categories array.
 */
export function getTranslatedCategories(t: TranslationFn): Category[] {
    return [
        { name: t('Landing Pages'), icon: Layout },
        { name: t('Dashboards'), icon: LayoutDashboard },
        { name: t('E-commerce'), icon: ShoppingCart },
        { name: t('Portfolios'), icon: Briefcase },
        { name: t('Web Apps'), icon: Globe },
        { name: t('Admin Panels'), icon: Settings },
    ];
}

// FAQ item interface
export interface FAQItem {
    question: string;
    answer: string;
}

/**
 * Get translated FAQs array.
 */
export function getTranslatedFAQs(t: TranslationFn): FAQItem[] {
    return [
        {
            question: t('How does the AI understand what I want to build?'),
            answer: t('Our AI is trained on millions of web development projects and understands natural language descriptions. Simply describe your project in plain English, and it will generate the appropriate code structure, components, and styling.'),
        },
        {
            question: t('Can I export my code and use it elsewhere?'),
            answer: t('Absolutely! You own all the code you generate. You can export your entire project as a zip file and deploy it anywhere - on your own servers, Vercel, Netlify, or any other hosting platform.'),
        },
        {
            question: t('What technologies does the generated code use?'),
            answer: t('Our AI generates modern, production-ready code tailored to your chosen output — React, TypeScript, and Tailwind CSS for websites, plus installable CMS and store themes. Everything follows best practices and stays fully customizable.'),
        },
        {
            question: t('Is there a limit to how many projects I can create?'),
            answer: t('It depends on your plan. Free users can create a limited number of projects, while paid plans offer more or unlimited projects. Check our pricing section for details.'),
        },
        {
            question: t('Can I use my own API keys?'),
            answer: t('Yes, premium plans allow you to use your own AI API keys. This gives you more control over your usage and can help reduce costs for high-volume users.'),
        },
    ];
}

// Testimonial item interface
export interface TestimonialItem {
    quote: string;
    author: string;
    role: string;
    rating: number;
    avatar?: string | null;
    company_url?: string | null;
}

/**
 * Get translated testimonials array.
 */
export function getTranslatedTestimonials(t: TranslationFn): TestimonialItem[] {
    return [
        {
            quote: t('This tool has transformed how we build websites. What used to take weeks now takes hours.'),
            author: t('Sarah Chen'),
            role: t('Lead Developer at TechFlow'),
            rating: 5,
        },
        {
            quote: t("The AI understands exactly what I need. It's like having a senior developer on demand."),
            author: t('Marcus Rodriguez'),
            role: t('Founder at LaunchPad'),
            rating: 5,
        },
        {
            quote: t("We've cut our development time by 80%. The ROI has been incredible."),
            author: t('Emily Thompson'),
            role: t('CTO at BuildCorp'),
            rating: 5,
        },
    ];
}
