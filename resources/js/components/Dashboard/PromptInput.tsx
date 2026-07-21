import { useState, useEffect, useRef, Fragment } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { ArrowRight, ArrowLeft, LayoutTemplate, Palette, Paintbrush, Database, Github, Globe, Blocks, ShoppingBag, SlidersHorizontal, Eye } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import type { DesignSystemOption } from '@/types/design';
import { DesignSystemThumbnail } from '@/components/Design/DesignSystemThumbnail';
import { DesignSystemPreviewModal } from '@/components/Design/DesignSystemPreviewModal';
import type { SupabaseConnectionOption, GithubConnectionOption, ShopifyConnectionOption } from '@/types';

interface Template {
    id: number;
    name: string;
    description: string | null;
    thumbnail: string | null;
    is_system: boolean;
    output_target?: 'website' | 'wordpress_theme' | 'shopify_theme';
}

type OutputTarget = 'website' | 'wordpress_theme' | 'shopify_theme';

interface PromptInputProps {
    onSubmit: (
        prompt: string,
        templateId: number | null,
        designSystemId: number | null,
        designAccent: string | null,
        supabaseConnectionId: number | null,
        githubConnectionId: number | null,
        shopifyConnectionId: number | null,
        outputTarget: OutputTarget,
    ) => void;
    disabled?: boolean;
    suggestions?: string[];
    typingPrompts?: string[];
    isLoadingSuggestions?: boolean;
    templates?: Template[];
    designSystems?: DesignSystemOption[];
    supabaseConnections?: SupabaseConnectionOption[];
    githubConnections?: GithubConnectionOption[];
    shopifyConnections?: ShopifyConnectionOption[];
    wordpressEnabled?: boolean;
    shopifyEnabled?: boolean;
    /** Whether BYOS store connections are enabled (operator toggle). When
     *  false, Shopify themes are download-only and the store picker is hidden. */
    canConnectShopify?: boolean;
    /** Pre-fills the textarea (e.g. a prompt carried over from the landing page). */
    initialPrompt?: string;
}

const DEFAULT_SUGGESTIONS = [
    'Build a task management app',
    'Create a portfolio website',
    'Design a landing page',
    'Make an e-commerce store',
];

const DEFAULT_TYPING_PROMPTS = [
    'Build me a modern portfolio website with dark mode...',
    'Create a task management app with drag and drop...',
    'Design a landing page for my SaaS startup...',
    'Make an e-commerce store with cart functionality...',
    'Build a blog platform with markdown support...',
    'Create a dashboard for tracking analytics...',
    'Design a booking system for appointments...',
    'Build a social media feed with infinite scroll...',
];

function useTypingAnimation(texts: string[], typingSpeed = 50, pauseDuration = 2000, deletingSpeed = 30) {
    const [displayText, setDisplayText] = useState('');
    const [textIndex, setTextIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(true);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        const currentText = texts[textIndex];

        if (isPaused) {
            const pauseTimer = setTimeout(() => {
                setIsPaused(false);
                setIsTyping(false);
            }, pauseDuration);
            return () => clearTimeout(pauseTimer);
        }

        if (isTyping) {
            if (displayText.length < currentText.length) {
                const typingTimer = setTimeout(() => {
                    setDisplayText(currentText.slice(0, displayText.length + 1));
                }, typingSpeed);
                return () => clearTimeout(typingTimer);
            } else {
                // eslint-disable-next-line react-hooks/set-state-in-effect -- animation state machine transition
                setIsPaused(true);
            }
        } else {
            if (displayText.length > 0) {
                const deletingTimer = setTimeout(() => {
                    setDisplayText(displayText.slice(0, -1));
                }, deletingSpeed);
                return () => clearTimeout(deletingTimer);
            } else {
                setTextIndex((prev) => (prev + 1) % texts.length);
                setIsTyping(true);
            }
        }
    }, [displayText, isTyping, isPaused, textIndex, texts, typingSpeed, pauseDuration, deletingSpeed]);

    return displayText;
}

export function PromptInput({
    onSubmit,
    disabled = false,
    suggestions = DEFAULT_SUGGESTIONS,
    typingPrompts = DEFAULT_TYPING_PROMPTS,
    isLoadingSuggestions = false,
    templates = [],
    designSystems = [],
    supabaseConnections = [],
    githubConnections = [],
    shopifyConnections = [],
    wordpressEnabled = false,
    shopifyEnabled = false,
    canConnectShopify = false,
    initialPrompt = '',
}: PromptInputProps) {
    const { t, isRtl } = useTranslation();
    const [prompt, setPrompt] = useState(initialPrompt);
    const [isFocused, setIsFocused] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    // null = Automatic (the AI picks a design system at first build).
    const [selectedDesignSystemId, setSelectedDesignSystemId] = useState<number | null>(null);
    const [selectedAccent, setSelectedAccent] = useState<string | null>(null);
    const [designPreviewOpen, setDesignPreviewOpen] = useState(false);
    // null = No database attached.
    const [selectedConnectionId, setSelectedConnectionId] = useState<number | null>(null);
    // null = No GitHub repo (the AI builds without pushing to a repo).
    const [selectedGithubConnectionId, setSelectedGithubConnectionId] = useState<number | null>(null);
    // null = No Shopify store (the theme builds/downloads without pushing to a store).
    const [selectedShopifyConnectionId, setSelectedShopifyConnectionId] = useState<number | null>(null);
    // The generation output target. 'website' (default) or 'wordpress_theme'.
    const [outputTarget, setOutputTarget] = useState<OutputTarget>('website');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const animatedPlaceholder = useTypingAnimation(typingPrompts);

    // Filter out system templates (only for AI to decide), and scope to the
    // selected output target's family (website templates vs WordPress themes).
    const userSelectableTemplates = templates.filter(
        (t) => !t.is_system && (t.output_target ?? 'website') === outputTarget,
    );

    const handleSelectOutputTarget = (next: OutputTarget) => {
        if (next === outputTarget) return;
        setOutputTarget(next);
        // A template id from one family is invalid for the other — reset to Automatic.
        setSelectedTemplateId(null);
        // Entering WordPress or Shopify mode: drop the Database selection (no
        // Webby-managed DB for themes) and the GitHub selection (avoid carrying
        // a stale link). GitHub remains valid in website mode, so don't clear it
        // on the way back.
        if (next === 'wordpress_theme' || next === 'shopify_theme') {
            setSelectedConnectionId(null);
            setSelectedGithubConnectionId(null);
        }
        // The Shopify store picker only applies to Shopify themes — clear it
        // whenever we leave Shopify mode so a stale store can't carry over.
        if (next !== 'shopify_theme') {
            setSelectedShopifyConnectionId(null);
        }
    };

    const selectedDesignSystem = designSystems.find((d) => d.id === selectedDesignSystemId) ?? null;

    const handleSelectDesignSystem = (value: string) => {
        if (value === 'automatic') {
            setSelectedDesignSystemId(null);
            setSelectedAccent(null);
            return;
        }
        const id = parseInt(value);
        setSelectedDesignSystemId(id);
        // Drop a chosen accent if the new system doesn't offer it.
        const system = designSystems.find((d) => d.id === id);
        if (selectedAccent && system && !system.accents.includes(selectedAccent)) {
            setSelectedAccent(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim() && !disabled) {
            onSubmit(prompt.trim(), selectedTemplateId, selectedDesignSystemId, selectedAccent, selectedConnectionId, selectedGithubConnectionId, selectedShopifyConnectionId, outputTarget);
            setPrompt('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    const showAnimatedPlaceholder = !prompt && !isFocused;

    return (
        <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
                <div className="relative bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder={isFocused ? t("I want to build...") : ""}
                            aria-label={t("I want to build...")}
                            disabled={disabled}
                            className="w-full px-4 py-4 text-base resize-none focus:outline-none focus:ring-0 border-0 min-h-[100px] bg-transparent relative z-10 disabled:cursor-not-allowed disabled:opacity-50"
                            rows={3}
                        />
                        {/* Animated placeholder overlay */}
                        {showAnimatedPlaceholder && (
                            <div
                                className="absolute inset-0 px-4 py-4 pointer-events-none text-muted-foreground/60 text-base"
                                onClick={() => textareaRef.current?.focus()}
                            >
                                {animatedPlaceholder}
                                <span className="inline-block w-0.5 h-5 bg-primary/50 ms-0.5 animate-pulse align-middle" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-muted/50 border-t border-border">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Output type — a scalable dropdown (shown only when there is
                                more than one output type, i.e. the WordPress or Shopify
                                plugin is on). Future platforms just add SelectItems here. */}
                            {(wordpressEnabled || shopifyEnabled) && (
                                <Select value={outputTarget} onValueChange={(v) => handleSelectOutputTarget(v as OutputTarget)}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <SelectTrigger className="w-[160px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>{t('What you are building')}</TooltipContent>
                                    </Tooltip>
                                    <SelectContent>
                                        <SelectItem value="website">
                                            <div className="flex items-center gap-2">
                                                <Globe className="h-4 w-4 shrink-0" />
                                                <span>{t('Website')}</span>
                                            </div>
                                        </SelectItem>
                                        {wordpressEnabled && (
                                            <SelectItem value="wordpress_theme">
                                                <div className="flex items-center gap-2">
                                                    <Blocks className="h-4 w-4 shrink-0" />
                                                    <span>{t('WordPress Theme')}</span>
                                                </div>
                                            </SelectItem>
                                        )}
                                        {shopifyEnabled && (
                                            <SelectItem value="shopify_theme">
                                                <div className="flex items-center gap-2">
                                                    <ShoppingBag className="h-4 w-4 shrink-0" />
                                                    <span>{t('Shopify Theme')}</span>
                                                </div>
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}

                            {/* Customize — every look + connection picker, grouped into
                                sections so the bar never gets cramped and future plugins
                                slot into the right section without new top-level controls. */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button type="button" variant="outline" className="gap-2">
                                        <SlidersHorizontal className="h-4 w-4" />
                                        <span>{t('Customize')}</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="start" className="w-80 p-0">
                                    <div className="max-h-[60vh] space-y-4 overflow-y-auto p-4">
                                        {/* Structure */}
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('Structure')}</p>
                                            <div className="space-y-1.5">
                                                <label htmlFor="cz-template" className="text-sm text-muted-foreground">{t('Template')}</label>
                                                <Select value={selectedTemplateId?.toString() ?? 'automatic'} onValueChange={(v) => setSelectedTemplateId(v === 'automatic' ? null : parseInt(v))}>
                                                    <SelectTrigger id="cz-template" className="w-full"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="automatic">
                                                            <div className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4 shrink-0" /><span>{t('Automatic')}</span></div>
                                                        </SelectItem>
                                                        {userSelectableTemplates.map((template) => (
                                                            <SelectItem key={template.id} value={template.id.toString()}>
                                                                <div className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4 shrink-0" /><span>{t(template.name)}</span></div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Design */}
                                        {designSystems.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('Design')}</p>
                                                <div className="space-y-1.5">
                                                    <label htmlFor="cz-design" className="text-sm text-muted-foreground">{t('Design system')}</label>
                                                    <Select value={selectedDesignSystemId?.toString() ?? 'automatic'} onValueChange={handleSelectDesignSystem}>
                                                        <SelectTrigger id="cz-design" className="w-full"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="automatic">
                                                                <div className="flex items-center gap-2"><Palette className="h-4 w-4 shrink-0" /><span>{t('Automatic')}</span></div>
                                                            </SelectItem>
                                                            {designSystems.map((system) => (
                                                                <SelectItem key={system.id} value={system.id.toString()}>
                                                                    <div className="flex items-center gap-2"><Palette className="h-4 w-4 shrink-0" /><span>{t(system.name)}</span></div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {selectedDesignSystem?.has_preview && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setDesignPreviewOpen(true)}
                                                        className="group relative block w-full overflow-hidden rounded-md"
                                                        title={t('Preview :name', { name: t(selectedDesignSystem.name) })}
                                                    >
                                                        <DesignSystemThumbnail
                                                            slug={selectedDesignSystem.slug}
                                                            name={t(selectedDesignSystem.name)}
                                                            hasPreview
                                                            accent={selectedAccent}
                                                            className="w-full"
                                                        />
                                                        <span className="absolute inset-0 flex items-center justify-center bg-background/0 text-sm font-medium text-transparent transition-colors group-hover:bg-background/60 group-hover:text-foreground">
                                                            <Eye className="h-4 w-4 me-1.5" />
                                                            {t('Preview')}
                                                        </span>
                                                    </button>
                                                )}
                                                {selectedDesignSystem && selectedDesignSystem.accents.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <label htmlFor="cz-accent" className="text-sm text-muted-foreground">{t('Accent')}</label>
                                                        <Select value={selectedAccent ?? 'automatic'} onValueChange={(v) => setSelectedAccent(v === 'automatic' ? null : v)}>
                                                            <SelectTrigger id="cz-accent" className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="automatic">
                                                                    <div className="flex items-center gap-2"><Paintbrush className="h-4 w-4 shrink-0" /><span>{t('Default accent')}</span></div>
                                                                </SelectItem>
                                                                {selectedDesignSystem.accents.map((accent) => (
                                                                    <SelectItem key={accent} value={accent}>
                                                                        <div className="flex items-center gap-2"><Paintbrush className="h-4 w-4 shrink-0" /><span className="capitalize">{t(accent)}</span></div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                {selectedDesignSystem?.has_preview && (
                                                    <DesignSystemPreviewModal
                                                        slug={selectedDesignSystem.slug}
                                                        name={t(selectedDesignSystem.name)}
                                                        accent={selectedAccent}
                                                        open={designPreviewOpen}
                                                        onOpenChange={setDesignPreviewOpen}
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Data — website only (not available for theme targets) */}
                                        {outputTarget === 'website' && supabaseConnections.length > 0 && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('Data')}</p>
                                                <div className="space-y-1.5">
                                                    <label htmlFor="cz-database" className="text-sm text-muted-foreground">{t('Database')}</label>
                                                    <Select value={selectedConnectionId?.toString() ?? 'none'} onValueChange={(v) => setSelectedConnectionId(v === 'none' ? null : parseInt(v))}>
                                                        <SelectTrigger id="cz-database" className="w-full"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">
                                                                <div className="flex items-center gap-2"><Database className="h-4 w-4 shrink-0" /><span>{t('No database')}</span></div>
                                                            </SelectItem>
                                                            {supabaseConnections.map((connection) => (
                                                                <SelectItem key={connection.id} value={connection.id.toString()}>
                                                                    <div className="flex items-center gap-2"><Database className="h-4 w-4 shrink-0" /><span>{connection.label}</span></div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                        )}

                                        {/* Integrations — GitHub and, for Shopify themes, the
                                            optional store to auto-push to (a theme still builds
                                            and downloads without one). The store picker only
                                            appears when the operator enabled store connections. */}
                                        {(githubConnections.length > 0 || (outputTarget === 'shopify_theme' && canConnectShopify)) && (
                                            <div className="space-y-2">
                                                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('Integrations')}</p>
                                                {githubConnections.length > 0 && (
                                                    <div className="space-y-1.5">
                                                        <label htmlFor="cz-github" className="text-sm text-muted-foreground">{t('GitHub')}</label>
                                                        <Select value={selectedGithubConnectionId?.toString() ?? 'none'} onValueChange={(v) => setSelectedGithubConnectionId(v === 'none' ? null : parseInt(v))}>
                                                            <SelectTrigger id="cz-github" className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">
                                                                    <div className="flex items-center gap-2"><Github className="h-4 w-4 shrink-0" /><span>{t('No GitHub account')}</span></div>
                                                                </SelectItem>
                                                                {githubConnections.map((connection) => (
                                                                    <SelectItem key={connection.id} value={connection.id.toString()}>
                                                                        <div className="flex items-center gap-2"><Github className="h-4 w-4 shrink-0" /><span>{connection.label || connection.github_login}</span></div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                                {outputTarget === 'shopify_theme' && canConnectShopify && (
                                                    <div className="space-y-1.5">
                                                        <label htmlFor="cz-shopify" className="text-sm text-muted-foreground">{t('Shopify store')}</label>
                                                        {shopifyConnections.length > 0 ? (
                                                            <Select value={selectedShopifyConnectionId?.toString() ?? 'none'} onValueChange={(v) => setSelectedShopifyConnectionId(v === 'none' ? null : parseInt(v))}>
                                                                <SelectTrigger id="cz-shopify" className="w-full"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">
                                                                        <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 shrink-0" /><span>{t('No store — download only')}</span></div>
                                                                    </SelectItem>
                                                                    {shopifyConnections.map((connection) => (
                                                                        <SelectItem key={connection.id} value={connection.id.toString()}>
                                                                            <div className="flex items-center gap-2"><ShoppingBag className="h-4 w-4 shrink-0" /><span>{connection.label || connection.shop_domain}</span></div>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <p className="text-sm text-muted-foreground">
                                                                {t('Connect a store on the Shopify page to auto-push this theme.').split(':link').map((part, i) => (
                                                                    <Fragment key={i}>
                                                                        {i > 0 && <a href="/shopify" className="text-primary hover:underline">{t('Shopify page')}</a>}
                                                                        {part}
                                                                    </Fragment>
                                                                ))}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <VoiceInputButton
                                value={prompt}
                                onValueChange={setPrompt}
                                disabled={disabled}
                            />
                            <Button
                                type="submit"
                                disabled={!prompt.trim() || disabled}
                            >
                                <span className="hidden sm:inline">{t('Start')}</span>
                                {isRtl ? (
                                    <ArrowLeft className="h-4 w-4 sm:ms-2" />
                                ) : (
                                    <ArrowRight className="h-4 w-4 sm:ms-2" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Suggestions - Marquee */}
            {!disabled && (
                <div className="mt-4 overflow-hidden relative">
                    {/* Gradient fade on edges - RTL aware */}
                    <div className="absolute start-0 top-0 bottom-0 w-12 ltr:bg-gradient-to-r rtl:bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
                    <div className="absolute end-0 top-0 bottom-0 w-12 ltr:bg-gradient-to-l rtl:bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                    {isLoadingSuggestions ? (
                        <div className="flex items-center justify-center gap-3">
                            <Skeleton className="h-8 w-40 rounded-full" />
                            <Skeleton className="h-8 w-36 rounded-full" />
                            <Skeleton className="h-8 w-32 rounded-full" />
                            <Skeleton className="h-8 w-44 rounded-full" />
                        </div>
                    ) : (
                        <div className={`flex gap-3 hover:[animation-play-state:paused] ${isRtl ? 'animate-marquee-rtl' : 'animate-marquee'}`}>
                            {/* Duplicate suggestions for seamless loop */}
                            {[...suggestions, ...suggestions].map((suggestion, index) => (
                                <button
                                    key={`${suggestion}-${index}`}
                                    onClick={() => setPrompt(suggestion)}
                                    className="text-sm px-4 py-2 rounded-full bg-card hover:bg-accent border border-border text-muted-foreground hover:text-foreground transition-colors shadow-sm whitespace-nowrap shrink-0"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
