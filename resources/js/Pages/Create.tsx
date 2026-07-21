import { useState, useEffect } from 'react';
import { useScramble } from 'use-scramble';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toaster } from '@/components/ui/sonner';
import { AppSidebar } from '@/components/Sidebar/AppSidebar';
import { AppPageHeader } from '@/components/Header/AppPageHeader';
import { GradientBackground } from '@/components/Dashboard/GradientBackground';
import { PromptInput } from '@/components/Dashboard/PromptInput';
import { ChatPageSkeleton } from '@/components/Skeleton';
import { usePageTransition } from '@/hooks/usePageTransition';
import { useTranslation } from '@/contexts/LanguageContext';
import { CreateProps, PageProps } from '@/types';
import { AlertCircle } from 'lucide-react';
import { DemoResetNotice } from '@/components/DemoResetNotice';
import axios from 'axios';

export default function Create({
    user,
    isPusherConfigured,
    canCreateProject,
    cannotCreateReason,
    suggestions: initialSuggestions,
    typingPrompts: initialTypingPrompts,
    greeting: initialGreeting,
    templates,
    designSystems,
    supabaseConnections,
    githubConnections,
    shopifyConnections,
    wordpressEnabled,
    shopifyEnabled,
}: CreateProps) {
    const { t, locale } = useTranslation();
    const [suggestions, setSuggestions] = useState(initialSuggestions);
    const [typingPrompts, setTypingPrompts] = useState(initialTypingPrompts);
    const [greeting, setGreeting] = useState(initialGreeting);
    const [isLoadingAi, setIsLoadingAi] = useState(true);
    // Carry over a prompt typed on the landing page (saved before sign-up) and
    // clear it so it only pre-fills once.
    const [landingPrompt] = useState(() => {
        if (typeof window === 'undefined') return '';
        try {
            const saved = window.sessionStorage.getItem('landing_prompt');
            if (saved) window.sessionStorage.removeItem('landing_prompt');
            return saved ?? '';
        } catch {
            return '';
        }
    });
    const { errors, canConnectShopify } = usePage<PageProps & {
        errors?: { prompt?: string };
    }>().props;
    const { isNavigating, destinationUrl } = usePageTransition();

    // Update state when props change (e.g., after language switch)
    useEffect(() => {
        setSuggestions(initialSuggestions);
        setTypingPrompts(initialTypingPrompts);
        if (initialGreeting !== greeting) {
            setGreeting(initialGreeting);
        }
    }, [initialSuggestions, initialTypingPrompts, initialGreeting, greeting]);

    // Show toast when there are errors
    useEffect(() => {
        if (errors?.prompt) {
            toast.error(errors.prompt);
        }
    }, [errors]);

    // Scramble animation for greeting
    const { ref: greetingRef, replay: replayScramble } = useScramble({
        text: greeting,
        speed: 0.8,
        tick: 1,
        step: 1,
        scramble: 4,
        seed: 2,
    });

    // Replay scramble animation on Inertia navigation (handles same-page navigation)
    useEffect(() => {
        const removeListener = router.on('finish', (event) => {
            if (event.detail.visit.url.pathname === '/create') {
                replayScramble();
            }
        });

        return () => removeListener();
    }, [replayScramble]);

    // Replay scramble animation when locale changes
    useEffect(() => {
        replayScramble();
    }, [locale, replayScramble]);

    // Fetch AI-powered content after page loads
    useEffect(() => {
        const fetchAiContent = async () => {
            try {
                const response = await axios.get('/create/ai-content');
                if (response.data) {
                    setSuggestions(response.data.suggestions || initialSuggestions);
                    setTypingPrompts(response.data.typingPrompts || initialTypingPrompts);
                    if (response.data.greeting && response.data.greeting !== greeting) {
                        setGreeting(response.data.greeting);
                        // Replay scramble animation for new greeting
                        setTimeout(() => replayScramble(), 50);
                    }
                }
            } catch {
                // Keep static content on error
            } finally {
                setIsLoadingAi(false);
            }
        };

        // Defer fetch to not block initial render
        const timeoutId = setTimeout(fetchAiContent, 100);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePromptSubmit = (
        prompt: string,
        templateId: number | null,
        designSystemId: number | null,
        designAccent: string | null,
        supabaseConnectionId: number | null,
        githubConnectionId: number | null,
        shopifyConnectionId: number | null,
        outputTarget: 'website' | 'wordpress_theme' | 'shopify_theme',
    ) => {
        // Create a new project with the prompt and redirect to it
        router.post('/projects', {
            prompt,
            template_id: templateId,
            design_system_id: designSystemId,
            design_accent: designAccent,
            supabase_connection_id: supabaseConnectionId,
            github_connection_id: githubConnectionId,
            shopify_connection_id: shopifyConnectionId,
            output_target: outputTarget,
        });
    };

    return (
        <>
            <Head title={t("Create")} />
            <Toaster />
            <DemoResetNotice variant={user.role === 'admin' ? 'admin' : 'user'} />

            <TooltipProvider>
                <SidebarProvider>
                    <AppSidebar user={user} />
                    <SidebarInset className="bg-transparent">
                        <div className="relative min-h-screen bg-background">
                            <GradientBackground />

                            <AppPageHeader user={user} variant="transparent" />

                            {/* Hero Section - Full viewport height */}
                            <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 md:px-8">
                                {/* Greeting with scramble animation */}
                                <div className="prose prose-lg dark:prose-invert text-center mb-8">
                                    <h1
                                        ref={greetingRef}
                                        className="text-3xl md:text-4xl font-bold text-foreground mb-2"
                                    />
                                </div>

                                {/* Real-time not configured warning */}
                                {!isPusherConfigured && (
                                    <Alert variant="destructive" className="w-full max-w-3xl mb-4">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            {t('Real-time features are not configured. Please configure broadcast settings in Admin Settings → Integrations.')}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Cannot create project warning */}
                                {!canCreateProject && isPusherConfigured && (
                                    <Alert variant="destructive" className="w-full max-w-3xl mb-4">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            {cannotCreateReason}
                                            {user.role !== 'admin' && (
                                                <>
                                                    {' '}
                                                    <Link href="/billing/plans" className="underline font-semibold">
                                                        {t('View Plans')}
                                                    </Link>
                                                </>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Prompt Input */}
                                <div className="w-full max-w-3xl">
                                    <PromptInput
                                        onSubmit={handlePromptSubmit}
                                        disabled={!isPusherConfigured || !canCreateProject}
                                        suggestions={suggestions}
                                        typingPrompts={typingPrompts}
                                        isLoadingSuggestions={isLoadingAi}
                                        templates={templates ?? []}
                                        designSystems={designSystems ?? []}
                                        supabaseConnections={supabaseConnections ?? []}
                                        githubConnections={githubConnections ?? []}
                                        shopifyConnections={shopifyConnections ?? []}
                                        wordpressEnabled={wordpressEnabled}
                                        shopifyEnabled={shopifyEnabled}
                                        canConnectShopify={canConnectShopify}
                                        initialPrompt={landingPrompt}
                                    />
                                </div>
                            </div>

                        </div>
                    </SidebarInset>
                </SidebarProvider>
            </TooltipProvider>

            {/* Page transition skeleton */}
            {isNavigating && destinationUrl?.startsWith('/project/') && (
                <div className="fixed inset-0 z-[100] bg-background">
                    <ChatPageSkeleton />
                </div>
            )}
        </>
    );
}
