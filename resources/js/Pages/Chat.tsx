import { useState, useRef, useEffect, useCallback } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { MessageBubble } from '@/components/Chat/MessageBubble';
import { FileTree } from '@/components/Code/FileTree';
import { CodeEditor } from '@/components/Code/CodeEditor';
import { MessageListSkeleton } from '@/components/Skeleton';
import { useBuilderChat, BroadcastConfig, CompleteEvent } from '@/hooks/useBuilderChat';
import { sanitizeBuilderError } from '@/lib/builderErrors';
import { useChatSounds, SoundSettings } from '@/hooks/useChatSounds';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserChannel } from '@/hooks/useUserChannel';
import { useTranslation } from '@/contexts/LanguageContext';
import { PageProps, User } from '@/types';
import type { UserNotification } from '@/types/notifications';
import { Home, Eye, Code, Loader2, Hammer, ExternalLink, Brain, Settings, Globe, Download, PanelLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import axios from 'axios';
import PublishModal from '@/components/Project/PublishModal';
import { ProjectSettingsPanel, type CustomDomainSettings } from '@/components/Project/ProjectSettingsPanel';
import { InspectPreview } from '@/components/Preview/InspectPreview';
import { WordPressPlaygroundPreview } from '@/components/Preview/WordPressPlaygroundPreview';
import { ShopifyThemePreview } from '@/components/Preview/ShopifyThemePreview';
import { ChatInputWithMentions } from '@/components/Chat/ChatInputWithMentions';
import { BuildCreditsIndicator } from '@/components/Chat/BuildCreditsIndicator';
import MobilePaneTabs, { type MobilePane } from '@/components/Chat/MobilePaneTabs';
import { DesignDesigner } from '@/components/Design/DesignDesigner';
import { ClarificationQuestion } from '@/components/Chat/ClarificationQuestion';
import type { DesignSystemOption } from '@/types/design';
import { useBuildCredits, BuildCreditsInfo } from '@/hooks/useBuildCredits';
import { useInspectorSelection } from '@/hooks/useInspectorSelection';
import { useFlashToast } from '@/hooks/useFlashToast';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ElementMention, PendingEdit } from '@/types/inspector';
import type { AttachedFile, ClarificationOption } from '@/types/chat';

// Pattern to match clarification questions in assistant messages
// Format: [ASK_JSON]{"question":"...?","options":[{"id":"1","label":"Option 1"},{"id":"2","label":"Option 2"}]}[/ASK_JSON]
const CLARIFICATION_PATTERN = /\[ASK_JSON\](.*?)\[\/ASK_JSON\]/s;

function parseClarificationFromText(text: string): { question: string; options: ClarificationOption[] } | null {
    const match = text.match(CLARIFICATION_PATTERN);
    if (!match) return null;

    try {
        const data = JSON.parse(match[1]);
        if (data.question && Array.isArray(data.options)) {
            return {
                question: data.question,
                options: data.options.map((opt: any, idx: number) => ({
                    id: opt.id || `opt-${idx}`,
                    label: opt.label || opt.text || String(opt),
                    description: opt.description,
                })),
            };
        }
    } catch {
        // Not valid JSON, ignore
    }
    return null;
}

interface Project {
    id: string;
    name: string;
    initial_prompt: string | null;
    has_history: boolean;
    conversation_history: Array<{
        role: 'user' | 'assistant' | 'action';
        content: string;
        timestamp: string;
        category?: string;
        thinking_duration?: number;
        files?: Array<{ id: number; filename: string; mime_type: string }>;
    }>;
    preview_url: string | null;
    has_active_session: boolean;
    build_session_id: string | null;
    // Reconnection-related fields
    build_status?: string;
    can_reconnect?: boolean;
    build_started_at?: string | null;
    // Publishing fields
    subdomain: string | null;
    published_title: string | null;
    published_description: string | null;
    published_visibility: string;
    published_at: string | null;
    // Settings fields
    custom_instructions: string | null;
    output_target?: 'website' | 'wordpress_theme' | 'shopify_theme';
    design_system_id: number | null;
    design_accent: string | null;
    share_image: string | null;
    api_token?: string | null;
    custom_domain?: string | null;
    custom_domain_verified?: boolean;
    custom_domain_ssl_status?: string | null;
    supabase_connection_id?: number | null;
    shopify_connection_id?: number | null;
    shopify_store_domain?: string | null;
    shopify_theme_id?: string | null;
}

interface StorageSettings {
    enabled: boolean;
    usedBytes: number;
    limitMb: number | null;
    unlimited: boolean;
    maxFileSizeMb?: number;
    allowedTypes?: string[] | null;
}

interface ChatPageProps extends PageProps {
    project: Project;
    user: User;
    designSystems: DesignSystemOption[];
    pusherConfig: BroadcastConfig;
    soundSettings: SoundSettings;
    // Publishing props
    baseDomain: string;
    canUseSubdomains: boolean;
    canCreateMoreSubdomains: boolean;
    canUsePrivateVisibility: boolean;
    canExportCode: boolean;
    suggestedSubdomain: string;
    subdomainUsage: {
        used: number;
        limit: number | null;
        unlimited: boolean;
        remaining: number;
    };
    // Storage props
    storage?: StorageSettings;
    projectFiles?: AttachedFile[];
    // Domain props
    customDomain?: CustomDomainSettings;
    subdomainsGloballyEnabled?: boolean;
    customDomainsGloballyEnabled?: boolean;
    // Build credits
    buildCredits: BuildCreditsInfo;
}

type ViewMode = 'preview' | 'code' | 'settings';
type PreviewSubMode = 'preview' | 'inspect' | 'design';

const VIEW_MODES: ViewMode[] = ['preview', 'code', 'settings'];
const PREVIEW_SUB_MODES: PreviewSubMode[] = ['preview', 'inspect', 'design'];

function getInitialViewMode(): ViewMode {
    if (typeof window === 'undefined') return 'preview';
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    // 'inspect' and 'design' are now sub-modes of 'preview'
    if (tab === 'inspect' || tab === 'design') return 'preview';
    if (tab && VIEW_MODES.includes(tab as ViewMode)) {
        return tab as ViewMode;
    }
    return 'preview';
}

function getInitialChatCollapsed(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('webby:chat-collapsed') === '1';
}

function getInitialPreviewSubMode(): PreviewSubMode {
    if (typeof window === 'undefined') return 'preview';
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && PREVIEW_SUB_MODES.includes(tab as PreviewSubMode)) {
        return tab as PreviewSubMode;
    }
    return 'preview';
}

export default function Chat({
    project,
    user: _user,
    designSystems,
    pusherConfig,
    soundSettings,
    baseDomain,
    canUseSubdomains,
    canCreateMoreSubdomains,
    canUsePrivateVisibility,
    canExportCode,
    suggestedSubdomain,
    subdomainUsage,
    storage,
    projectFiles: initialProjectFiles,
    customDomain,
    subdomainsGloballyEnabled,
    customDomainsGloballyEnabled,
    buildCredits,
}: ChatPageProps) {
    const { t } = useTranslation();

    // Get unread notification count from shared props
    const { unreadNotificationCount, canConnectShopify } = usePage<PageProps & { unreadNotificationCount: number }>().props;
    useFlashToast();

    // Notification state
    const {
        notifications,
        unreadCount,
        isLoading: isLoadingNotifications,
        addNotification,
        markAsRead,
        markAllAsRead,
    } = useNotifications(unreadNotificationCount);

    // Subscribe to user channel for real-time notification updates
    useUserChannel({
        userId: _user.id,
        broadcastConfig: pusherConfig,
        enabled: !!pusherConfig?.key,
        onNotification: (notification: UserNotification) => {
            addNotification(notification);
            // Show toast for important notifications (but not build_complete/failed since we're on chat page)
            if (notification.type === 'credits_low') {
                toast(notification.title, {
                    description: notification.message,
                });
            }
        },
        onCreditsUpdated: (updated) => {
            updateCredits({
                remaining: updated.remaining,
                monthlyLimit: updated.monthlyLimit,
                isUnlimited: updated.isUnlimited,
                usingOwnKey: updated.usingOwnKey,
            });
        },
    });
    const [viewMode, setViewMode] = useState<ViewMode>(getInitialViewMode);
    const [previewSubMode, setPreviewSubMode] = useState<PreviewSubMode>(getInitialPreviewSubMode);

    // Collapse/hide the chat panel to give the preview full width (desktop only; mobile is always full-width chat).
    const isMobile = useIsMobile();
    const [chatCollapsed, setChatCollapsed] = useState<boolean>(getInitialChatCollapsed);

    // Mobile pane switching: below md, only one of the chat column / preview
    // column is visible at a time (both are full-width panes). Desktop always
    // shows both side by side and never renders the tab bar. A ref tracks the
    // latest pane for handleComplete without adding it to that callback's deps
    // (avoids re-subscribing the builder chat's realtime listeners on every tab switch).
    const [mobilePane, setMobilePane] = useState<MobilePane>('chat');
    const [previewDot, setPreviewDot] = useState(false);
    const mobilePaneRef = useRef<MobilePane>('chat');
    useEffect(() => {
        mobilePaneRef.current = mobilePane;
    }, [mobilePane]);
    const handleMobilePaneChange = useCallback((pane: MobilePane) => {
        setMobilePane(pane);
        if (pane === 'preview') {
            setPreviewDot(false);
        }
    }, []);
    const expandButtonRef = useRef<HTMLButtonElement>(null);
    const chatCollapsedPersisted = useRef(false);
    useEffect(() => {
        // Skip the first run so we don't write the key for users who never toggle the panel.
        if (!chatCollapsedPersisted.current) {
            chatCollapsedPersisted.current = true;
            return;
        }
        localStorage.setItem('webby:chat-collapsed', chatCollapsed ? '1' : '0');
    }, [chatCollapsed]);
    const handleCollapseChat = useCallback(() => {
        setChatCollapsed(true);
        // Move focus to the expand control so keyboard focus isn't stranded inside the now-hidden panel.
        requestAnimationFrame(() => expandButtonRef.current?.focus());
    }, []);

    // Sync viewMode and previewSubMode to URL
    useEffect(() => {
        const url = new URL(window.location.href);
        if (viewMode === 'preview') {
            if (previewSubMode === 'preview') {
                url.searchParams.delete('tab');
            } else {
                url.searchParams.set('tab', previewSubMode);
            }
        } else {
            url.searchParams.set('tab', viewMode);
        }
        window.history.replaceState({}, '', url.toString());
    }, [viewMode, previewSubMode]);

    const [prompt, setPrompt] = useState('');
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);
    const [previewRefreshTrigger, setPreviewRefreshTrigger] = useState(() => Date.now());
    const scrollEndRef = useRef<HTMLDivElement>(null);
    const initialSent = useRef(false);
    const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
    const [thinkingDuration, setThinkingDuration] = useState<number | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const lastAssistantMessageCount = useRef<number>(0);
    const [failedMessages, setFailedMessages] = useState<Array<{message: string; timestamp: number}>>([]);
    const [initialLoading, setInitialLoading] = useState(true);
    const [publishModalOpen, setPublishModalOpen] = useState(false);

    // File attachment state for @mentions and uploads
    const [localProjectFiles, setLocalProjectFiles] = useState<AttachedFile[]>(initialProjectFiles ?? []);
    const [uploadedFiles, setUploadedFiles] = useState<AttachedFile[]>([]);

    // Clarification question state
    const [activeClarification, setActiveClarification] = useState<{
        question: string;
        options: Array<{ id: string; label: string; description?: string }>;
        messageIndex: number;
    } | null>(null);

    const handleFileUploaded = useCallback((file: AttachedFile) => {
        setLocalProjectFiles(prev => [file, ...prev]);
        setUploadedFiles(prev => [...prev, file]);
    }, []);

    const handleRemoveUploadedFile = useCallback((fileId: number) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    }, []);

    // Handle files dropped onto the chat input — upload via axios and add as badges
    const handleFilesDropped = useCallback(async (files: File[]) => {
        if (!storage?.enabled || !project.id) return;
        const formData = new FormData();
        for (const file of files) {
            formData.set('file', file);
            try {
                const response = await axios.post(`/project/${project.id}/files`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                const serverFile = response.data.file;
                const attached: AttachedFile = {
                    id: serverFile.id,
                    filename: serverFile.original_filename,
                    mime_type: serverFile.mime_type,
                    size: serverFile.size,
                    human_size: serverFile.human_size,
                    is_image: serverFile.is_image,
                    url: serverFile.url,
                    preview_url: serverFile.preview_url ?? null,
                };
                handleFileUploaded(attached);
            } catch {
                // Upload errors are handled server-side; skip failed files
            }
        }
    }, [storage?.enabled, project.id, handleFileUploaded]);

    // Element selection state for inspect mode — clears automatically when leaving inspect
    const { selectedElement, setSelectedElement, pendingEdits, setPendingEdits, clearSelection } = useInspectorSelection(previewSubMode === 'inspect');

    // Design designer state
    const [isSavingDesign, setIsSavingDesign] = useState(false);
    const [appliedSystemId, setAppliedSystemId] = useState(project.design_system_id);
    const [appliedAccent, setAppliedAccent] = useState(project.design_accent);
    const [captureThumbnailTrigger, setCaptureThumbnailTrigger] = useState(0);

    // Sound effects for chat events
    const { playSound } = useChatSounds({ settings: soundSettings });

    // Build credits tracking with refresh capability
    const {
        credits,
        isRefreshing: isRefreshingCredits,
        update: updateCredits,
        refresh: refreshCredits,
    } = useBuildCredits(buildCredits);

    // Play sound when project is opened
    const hasPlayedOpenSound = useRef(false);
    useEffect(() => {
        if (!hasPlayedOpenSound.current) {
            playSound('open');
            hasPlayedOpenSound.current = true;
        }
    }, [playSound]);

    // Scroll support for suggestions - convert vertical wheel to horizontal scroll
    const suggestionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = suggestionsRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                container.scrollLeft += e.deltaY;
            }
        };

        // Use non-passive listener to allow preventDefault
        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [suggestions]);

    const handleComplete = useCallback((event: CompleteEvent) => {
        playSound('complete');
        if (event.files_changed) {
            toast.success(t('Build complete! Files have been updated.'));
            // NOTE: do NOT call setPreviewRefreshTrigger here. The agent
            // completion event fires when the LLM turn ends, which may be
            // BEFORE the verifyBuild tool has actually rewritten dist/.
            // The dedicated `handleBuildComplete` callback above listens
            // for the build-ready signal and refreshes the iframe at the
            // right moment — adding a second refresh here would force-
            // reload on stale output and also nuke any in-iframe user
            // state (scroll, form drafts) on every chat session, not
            // just ones that rebuild the site.
        } else {
            toast.success(t('Build complete!'));
        }
        // Drop the inspector's selected-element chip. After a rebuild, the
        // DOM node the chip points at has likely been re-rendered, so the
        // stored selector and textPreview are stale. The chat history keeps
        // the [AI_EDIT]/[STYLE_EDIT] message as context; only the dangling
        // pointer goes away.
        clearSelection();
        // Pull authoritative credit balance from the server now that the
        // build has consumed credits. The user-channel websocket SHOULD also
        // deliver a `credits.updated` event via the existing useUserChannel
        // subscription above, but the chat sidebar was observed in E2E to
        // remain stale until a full page reload. Refreshing here is robust
        // regardless of whether the websocket event was received in time.
        void refreshCredits();
        // Phone/tablet: nudge the user toward the Preview tab with a pulse dot
        // when the build finishes while they're still looking at chat. No
        // auto-switching — the user decides when to look.
        if (mobilePaneRef.current === 'chat') {
            setPreviewDot(true);
        }
    }, [playSound, t, refreshCredits, clearSelection]);

    const handleError = useCallback((error: string) => {
        playSound('error');
        toast.error(error);
    }, [playSound]);

    const handleMessage = useCallback(() => {
        playSound('message');
    }, [playSound]);

    const handleAction = useCallback(() => {
        playSound('action');
    }, [playSound]);

    const handleBuildComplete = useCallback((_previewUrl: string) => {
        setPreviewRefreshTrigger(Date.now());
        playSound('build');
    }, [playSound]);

    const errorSanitizer = useCallback(
        (rawError: string) => sanitizeBuilderError(rawError, t),
        [t]
    );

    const {
        messages,
        progress,
        isLoading,
        sendMessage,
        cancelBuild,
        triggerBuild,
        isBuildingPreview,
    } = useBuilderChat(project.id, {
        pusherConfig,
        initialHistory: project.conversation_history,
        initialPreviewUrl: project.preview_url,
        // Pass initial reconnection state from server
        initialSessionId: project.build_session_id,
        initialCanReconnect: project.can_reconnect ?? false,
        onComplete: handleComplete,
        onError: handleError,
        onMessage: handleMessage,
        onAction: handleAction,
        onBuildComplete: handleBuildComplete,
        errorSanitizer,
    });

    // Check for clarification questions in new messages
    useEffect(() => {
        // Find the last assistant message that contains a clarification question
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.type === 'assistant') {
                const clarification = parseClarificationFromText(msg.content);
                if (clarification) {
                    setActiveClarification({
                        ...clarification,
                        messageIndex: i,
                    });
                    break;
                }
            }
        }
    }, [messages]);

    // Undo/Redo/Restore state — mutually exclusive: each handler bails while
    // any other revision mutation (or a build) is in flight.
    const [isUndoing, setIsUndoing] = useState(false);
    const [isRedoing, setIsRedoing] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Surface the server's message (busy build, plan block, nothing to undo)
    // instead of a generic failure toast.
    const revisionErrorMessage = (error: unknown): string | undefined =>
        axios.isAxiosError(error) ? (error.response?.data as { error?: string } | undefined)?.error : undefined;

    const handleUndo = useCallback(async () => {
        if (isUndoing || isRedoing || isRestoring || isLoading) return;
        setIsUndoing(true);
        try {
            const response = await axios.post(`/builder/projects/${project.id}/undo`);
            if (response.data.success) {
                setPreviewRefreshTrigger(Date.now());
                toast.success(t('Undone'));
            } else {
                toast.error(response.data.error || t('Nothing to undo'));
            }
        } catch (error) {
            toast.error(revisionErrorMessage(error) || t('Undo failed'));
        } finally {
            setIsUndoing(false);
        }
    }, [project.id, isUndoing, isRedoing, isRestoring, isLoading, t]);

    const handleRedo = useCallback(async () => {
        if (isUndoing || isRedoing || isRestoring || isLoading) return;
        setIsRedoing(true);
        try {
            const response = await axios.post(`/builder/projects/${project.id}/redo`);
            if (response.data.success) {
                setPreviewRefreshTrigger(Date.now());
                toast.success(t('Redone'));
            } else {
                toast.error(response.data.error || t('Nothing to redo'));
            }
        } catch (error) {
            toast.error(revisionErrorMessage(error) || t('Redo failed'));
        } finally {
            setIsRedoing(false);
        }
    }, [project.id, isUndoing, isRedoing, isRestoring, isLoading, t]);

    // Restore a specific revision from the history panel. Returns whether the
    // restore applied so the panel can refresh its list.
    const handleRestoreRevision = useCallback(async (revisionId: number): Promise<boolean> => {
        if (isUndoing || isRedoing || isRestoring || isLoading) return false;
        setIsRestoring(true);
        try {
            const response = await axios.post(`/builder/projects/${project.id}/restore`, {
                revision_id: revisionId,
            });
            if (response.data.success) {
                setPreviewRefreshTrigger(Date.now());
                toast.success(t('Restored'));
                return true;
            }
            toast.error(response.data.error || t('Restore failed'));
            return false;
        } catch (error) {
            toast.error(revisionErrorMessage(error) || t('Restore failed'));
            return false;
        } finally {
            setIsRestoring(false);
        }
    }, [project.id, isUndoing, isRedoing, isRestoring, isLoading, t]);

    // Keyboard shortcuts for undo/redo (skip when typing in input/textarea).
    // e.key reflects Shift ('Z'), so compare lowercased; Ctrl+Y is the
    // conventional Windows redo.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable) return;
            if (!(e.metaKey || e.ctrlKey)) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            }
            if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    // Track if initial scroll has been done
    const initialScrollDone = useRef(false);

    // Clear initial loading state after first render
    useEffect(() => {
        const timer = setTimeout(() => setInitialLoading(false), 100);
        return () => clearTimeout(timer);
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (!initialScrollDone.current && messages.length > 0) {
            // Initial load: use instant scroll with a small delay to ensure content is rendered
            const timer = setTimeout(() => {
                scrollEndRef.current?.scrollIntoView({ behavior: 'instant' });
                initialScrollDone.current = true;
            }, 100);
            return () => clearTimeout(timer);
        } else if (initialScrollDone.current) {
            // Subsequent updates: use smooth scroll
            scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, progress, failedMessages]);

    // Scroll to bottom when suggestions panel appears (to prevent covering last message)
    const prevSuggestionsVisible = useRef(false);
    useEffect(() => {
        const isVisible = isLoadingSuggestions || (suggestions.length > 0 && !isLoading);
        if (isVisible && !prevSuggestionsVisible.current) {
            // Small delay to let the suggestions render and layout adjust
            const timer = setTimeout(() => {
                scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
            prevSuggestionsVisible.current = isVisible;
            return () => clearTimeout(timer);
        }
        prevSuggestionsVisible.current = isVisible;
    }, [suggestions, isLoadingSuggestions, isLoading]);

    // Calculate thinking duration when build completes
    useEffect(() => {
        if (progress.status === 'completed' && thinkingStartTime) {
            const duration = Math.round((Date.now() - thinkingStartTime) / 1000);
            setThinkingDuration(duration);
            setThinkingStartTime(null);
        }
    }, [progress.status, thinkingStartTime]);

    // Send initial message from project prompt (only for new projects with no history)
    useEffect(() => {
        if (project.initial_prompt && !initialSent.current && !project.has_history) {
            initialSent.current = true;
            playSound('send');
            setThinkingStartTime(Date.now());
            setThinkingDuration(null);
            sendMessage(project.initial_prompt);
        }
    }, [project.initial_prompt, project.has_history, sendMessage, playSound]);

    // Auto-rebuild preview for projects with history but no preview
    const autoRebuildTriggered = useRef(false);
    useEffect(() => {
        if (project.has_history && !project.preview_url && project.build_status !== 'building' && !autoRebuildTriggered.current) {
            autoRebuildTriggered.current = true;
            triggerBuild();
        }
    }, [project.has_history, project.preview_url, project.build_status, triggerBuild]);

    // Fetch AI suggestions
    const fetchSuggestions = useCallback(async () => {
        setIsLoadingSuggestions(true);
        try {
            const response = await axios.get(`/project/${project.id}/suggestions`);
            if (response.data.suggestions) {
                setSuggestions(response.data.suggestions);
            }
        } catch {
            // Silently fail - suggestions are optional
            setSuggestions([]);
        } finally {
            setIsLoadingSuggestions(false);
        }
    }, [project.id]);

    // Track if initial page load is complete
    const isInitialLoad = useRef(true);

    // Fetch suggestions when a new assistant message arrives (deferred on initial load)
    useEffect(() => {
        const assistantMessages = messages.filter(m => m.type === 'assistant');
        const currentCount = assistantMessages.length;

        // Skip if no assistant messages or count hasn't changed
        if (currentCount === 0 || currentCount === lastAssistantMessageCount.current || isLoading) {
            return;
        }

        lastAssistantMessageCount.current = currentCount;

        // Defer suggestions fetch on initial load to not block page render
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            // Use requestIdleCallback or setTimeout to fetch after page is interactive
            const timeoutId = setTimeout(() => {
                fetchSuggestions();
            }, 1000); // 1 second delay for initial load
            return () => clearTimeout(timeoutId);
        }

        // For subsequent messages, fetch immediately
        fetchSuggestions();
    }, [messages, isLoading, fetchSuggestions]);

    // Fill input when suggestion is clicked
    const handleSuggestionClick = (suggestion: string) => {
        setPrompt(suggestion);
        setSuggestions([]);
    };

    const handleSubmit = async (e: React.FormEvent, fileData?: { fileIds: number[]; attachedFiles: AttachedFile[] }) => {
        e.preventDefault();
        if ((!prompt.trim() && !selectedElement && !fileData?.fileIds.length) || isLoading) return;

        const msg = prompt.trim();
        const elementContext = selectedElement ? {
            tagName: selectedElement.tagName,
            selector: selectedElement.selector,
            textPreview: selectedElement.textPreview,
        } : undefined;

        setPrompt('');
        setSelectedElement(null); // Clear selected element after sending
        setUploadedFiles([]); // Clear uploaded file badges after sending
        setSuggestions([]); // Clear suggestions when sending

        // Check if builder is online before sending
        try {
            const healthResponse = await axios.get(`/builder/projects/${project.id}/health`);
            if (!healthResponse.data.online) {
                // Builder offline - add to failed messages (local state only, disappears on reload)
                setFailedMessages(prev => [...prev, { message: msg, timestamp: Date.now() }]);
                return;
            }
        } catch {
            // Builder unreachable - add to failed messages (local state only, disappears on reload)
            setFailedMessages(prev => [...prev, { message: msg, timestamp: Date.now() }]);
            return;
        }

        // Builder online - proceed with sending
        playSound('send');
        setThinkingStartTime(Date.now());
        setThinkingDuration(null);
        await sendMessage(msg, {
            elementContext,
            fileIds: fileData?.fileIds,
            attachedFiles: fileData?.attachedFiles,
        });
    };

    // Send style edit message with health check (used by preview inspector)
    const handleSendStyleEdit = useCallback(async (msg: string) => {
        if (isLoading) return;
        try {
            const healthResponse = await axios.get(`/builder/projects/${project.id}/health`);
            if (!healthResponse.data.online) return;
        } catch {
            return;
        }
        playSound('send');
        setThinkingStartTime(Date.now());
        setThinkingDuration(null);
        await sendMessage(msg);
    }, [isLoading, project.id, playSound, sendMessage]);

    // Deterministic class edit from the Style panel — instant, no AI session.
    // Returns true when the builder applied it (the element was located by its
    // unique className + text anchor); false (ambiguous/dynamic/error) tells the
    // caller to fall back to the AI style-edit path.
    const handleApplyStyleClasses = useCallback(async (payload: { oldClassName: string; newClassName: string; textAnchor: string }): Promise<boolean> => {
        if (isLoading) return false;
        try {
            const res = await axios.patch(`/builder/projects/${project.id}/class-edit`, {
                old_class_name: payload.oldClassName,
                new_class_name: payload.newClassName,
                text_anchor: payload.textAnchor,
            });
            if (res.data?.success === true) {
                setPreviewRefreshTrigger(Date.now());
                setCaptureThumbnailTrigger(Date.now());
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, [isLoading, project.id]);

    // Element selection handler for inspect mode
    const handleElementSelect = useCallback((element: ElementMention) => {
        setSelectedElement(element);
    }, [setSelectedElement]);

    // Handler for inline edits from inspect mode
    const handleElementEdit = useCallback((edit: PendingEdit) => {
        setPendingEdits(prev => {
            // Replace if editing same element and field
            const existingIndex = prev.findIndex(
                e => e.element.cssSelector === edit.element.cssSelector && e.field === edit.field
            );
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = edit;
                return updated;
            }
            return [...prev, edit];
        });
    }, [setPendingEdits]);

    // Save all pending edits to AI
    const handleSaveAllEdits = useCallback(async () => {
        if (pendingEdits.length === 0) return;

        const editLines = pendingEdits.map((edit, i) => {
            if (edit.field === 'text') {
                return `${i + 1}. <${edit.element.tagName}${edit.element.cssSelector}>: "${edit.originalValue}" → "${edit.newValue}"`;
            }
            return `${i + 1}. <${edit.element.tagName}> ${edit.field}: "${edit.originalValue}" → "${edit.newValue}"`;
        }).join('\n');

        const message = `[BATCH_EDIT] Update multiple elements:\n${editLines}`;
        await sendMessage(message);
        setPendingEdits([]);
    }, [pendingEdits, sendMessage, setPendingEdits]);

    // Discard all pending edits
    const handleDiscardAllEdits = useCallback(() => {
        setPendingEdits([]);
    }, [setPendingEdits]);

    // Remove a single pending edit
    const handleRemoveEdit = useCallback((id: string) => {
        setPendingEdits(prev => prev.filter(e => e.id !== id));
    }, [setPendingEdits]);

    const currentAction = progress.actions.length > 0
        ? progress.actions[progress.actions.length - 1]
        : null;

    // Get status text for header
    const getStatusText = () => {
        if (progress.status === 'connecting') return t('Connecting...');
        if (progress.status === 'running') {
            if (currentAction) {
                return `${currentAction.action}: ${currentAction.target || ''}`.slice(0, 30);
            }
            return t('Building...');
        }
        if (isLoading) return t('AI working...');
        return t('Ready');
    };

    return (
        <>
            <Head title={project.name} />
            <Toaster />

            <div className="h-dvh flex flex-col bg-background text-foreground pt-[var(--impersonation-banner-height,0px)] pb-[var(--cookie-banner-h,0px)]">
                <div className="flex flex-1 min-h-0">
                {/* Start: Chat Column - Full width on mobile, fixed width on larger screens */}
                <div
                    data-testid="chat-column"
                    className={`${mobilePane === 'chat' ? 'flex' : 'hidden'} md:flex w-full shrink-0 flex-col transition-[width] duration-200 ease-linear ${
                        chatCollapsed ? 'md:w-0 md:overflow-hidden md:border-e-0' : 'md:w-[420px] md:border-e'
                    }`}
                    // Only inert when actually hidden (md+ collapsed). On mobile the panel is full-width and
                    // is the only UI, so it must stay interactive even if collapsed was persisted from desktop.
                    inert={chatCollapsed && !isMobile ? true : undefined}
                >
                    {/* Chat Header */}
                    <div className="h-14 px-4 border-b flex items-center justify-between shrink-0 bg-background">
                        <div className="min-w-0 flex-1">
                            {/* Desktop: switch to settings view */}
                            <button
                                onClick={() => setViewMode('settings')}
                                className="hover:underline text-start hidden md:block w-full min-w-0"
                            >
                                <h1 className="text-sm font-semibold truncate">
                                    {project.name}
                                </h1>
                            </button>
                            {/* Mobile: navigate to settings page */}
                            <Link
                                href={`/project/${project.id}/settings`}
                                className="hover:underline md:hidden block w-full min-w-0"
                            >
                                <h1 className="text-sm font-semibold truncate">
                                    {project.name}
                                </h1>
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">
                                {isLoading ? (
                                    <span className="flex items-center gap-1.5">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        {getStatusText()}
                                    </span>
                                ) : (
                                    getStatusText()
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-1">
                            {/* Mobile only: navigate to settings page (desktop has Settings tab in preview panel) */}
                            <Button variant="ghost" size="icon" asChild className="md:hidden">
                                <Link href={`/project/${project.id}/settings`}>
                                    <Settings className="h-4 w-4" />
                                </Link>
                            </Button>
                            <NotificationBell
                                notifications={notifications}
                                unreadCount={unreadCount}
                                onMarkAsRead={markAsRead}
                                onMarkAllAsRead={markAllAsRead}
                                isLoading={isLoadingNotifications}
                            />
                            <Button variant="ghost" size="icon" asChild>
                                <Link href="/create">
                                    <Home className="h-4 w-4" />
                                </Link>
                            </Button>
                            {/* Desktop only: collapse the chat panel to give the preview full width */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="hidden md:inline-flex"
                                onClick={handleCollapseChat}
                                title={t('Collapse chat')}
                                aria-label={t('Collapse chat')}
                            >
                                <PanelLeft className="h-4 w-4 rtl:rotate-180" />
                            </Button>
                        </div>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="p-4 space-y-4">
                            {initialLoading && messages.length === 0 ? (
                                <MessageListSkeleton count={3} />
                            ) : messages.length === 0 && !isLoading ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 rounded-full bg-primary mx-auto mb-4 flex items-center justify-center">
                                        <span className="text-primary-foreground text-xl">{'\u2728'}</span>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert">
                                        <h2 className="text-lg font-semibold mb-2">
                                            {t('What do you want to build?')}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            {t("Describe your website and I'll create it for you")}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                messages.map((msg, index) => {
                                    // Show thinking duration for assistant messages
                                    // Use saved thinkingDuration from history, or current session's calculated duration for last message
                                    const isLastAssistant = msg.type === 'assistant' && index === messages.length - 1;
                                    const displayDuration = msg.thinkingDuration ?? (isLastAssistant && !isLoading ? thinkingDuration : null);
                                    const showThinkingDuration = msg.type === 'assistant' && displayDuration !== null && displayDuration !== undefined;

                                    return (
                                        <div key={msg.id}>
                                            {showThinkingDuration && (
                                                <div className="prose prose-xs dark:prose-invert flex items-center gap-2 text-muted-foreground text-sm mb-2 ms-11">
                                                    <span>{'\uD83D\uDCAD'}</span>
                                                    <span>{t('Thought for :duration s', { duration: displayDuration })}</span>
                                                </div>
                                            )}
                                            <MessageBubble message={msg} />
                                        </div>
                                    );
                                })
                            )}

                            {/* Failed message indicator (local state only) */}
                            {failedMessages.map((failed) => (
                                <div key={failed.timestamp} className="flex flex-col items-end gap-1 animate-fade-in">
                                    <div className="max-w-[85%] px-4 py-2 rounded-2xl ltr:rounded-br-md rtl:rounded-bl-md bg-primary text-primary-foreground">
                                        <p className="text-sm whitespace-pre-wrap break-words">
                                            {failed.message}
                                        </p>
                                    </div>
                                    <p className="text-xs text-destructive me-2">
                                        {t('Builder offline, message not sent')}
                                    </p>
                                </div>
                            ))}

                            {/* AI Working Indicator */}
                            {isLoading && (
                                <div className="sticky bottom-0 z-10 flex justify-center py-2 bg-gradient-to-t from-background via-background/80 to-transparent">
                                    <div className="flex items-center gap-2 animate-fade-in rounded-full bg-muted/60 backdrop-blur-sm border border-border/50 px-3 py-1.5 shadow-sm">
                                        <Brain className="w-4 h-4 animate-rainbow-icon" />
                                        <span className="text-sm font-medium animate-rainbow">{t('Thinking...')}</span>
                                        {currentAction && (
                                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                {`${currentAction.action}: ${currentAction.target || ''}`.slice(0, 40)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div ref={scrollEndRef} />
                        </div>
                    </ScrollArea>

                    {/* Floating suggestions - pinned to bottom of messages */}
                    {(isLoadingSuggestions || (suggestions.length > 0 && !isLoading)) && (
                        <div className="relative w-full bg-background py-2">
                            {isLoadingSuggestions ? (
                                <div className="flex gap-2 px-4">
                                    <Skeleton className="h-6 w-28 rounded-full shrink-0" />
                                    <Skeleton className="h-6 w-36 rounded-full shrink-0" />
                                    <Skeleton className="h-6 w-24 rounded-full shrink-0" />
                                </div>
                            ) : (
                                <>
                                    <div
                                        ref={suggestionsRef}
                                        className="flex w-full select-none flex-nowrap gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide"
                                    >
                                        {suggestions.map((suggestion, index) => (
                                            <button
                                                key={index}
                                                type="button"
                                                onClick={() => handleSuggestionClick(suggestion)}
                                                className="px-2.5 py-1 text-xs bg-primary hover:bg-primary/90 rounded-full text-primary-foreground transition-colors whitespace-nowrap flex-none"
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                    {/* Fade effect on end edge - sibling of scroll container */}
                                    <div className="pointer-events-none absolute end-0 top-0 h-full w-16 ltr:bg-gradient-to-l rtl:bg-gradient-to-r from-background to-transparent" />
                                </>
                            )}
                        </div>
                    )}

                    {/* Input */}
                    <div className="pt-2 px-4 pb-4 border-t bg-background">
                        <div className="pb-1 flex items-center justify-between">
                            <BuildCreditsIndicator {...credits} isRefreshing={isRefreshingCredits} />
                            <div className="flex items-center gap-2">
                                <ThemeToggle />
                                <LanguageSelector />
                            </div>
                        </div>
                        <ChatInputWithMentions
                            value={prompt}
                            onChange={setPrompt}
                            onSubmit={handleSubmit}
                            disabled={isLoading}
                            selectedElement={selectedElement}
                            onClearElement={() => setSelectedElement(null)}
                            placeholder={t('Describe what you want to build...')}
                            isLoading={isLoading}
                            onCancel={cancelBuild}
                            storageEnabled={storage?.enabled ?? false}
                            projectId={project.id}
                            maxFileSizeMb={storage?.maxFileSizeMb ?? 10}
                            allowedTypes={storage?.allowedTypes ?? null}
                            projectFiles={localProjectFiles}
                            uploadedFiles={uploadedFiles}
                            onFileUploaded={handleFileUploaded}
                            onRemoveUploadedFile={handleRemoveUploadedFile}
                            onFilesDropped={handleFilesDropped}
                        />
                    </div>
                </div>

                {/* Right: Preview/Code Column - Full-width pane on mobile, gated by mobilePane */}
                <div
                    data-testid="preview-column"
                    className={`${mobilePane === 'preview' ? 'flex' : 'hidden'} md:flex flex-1 flex-col overflow-hidden`}
                >
                    {/* Preview Header */}
                    <div className="h-14 px-4 border-b flex items-center justify-between shrink-0 bg-background">
                        {/* View toggle */}
                        <div className="flex items-center gap-2">
                            {chatCollapsed && (
                                <Button
                                    ref={expandButtonRef}
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setChatCollapsed(false)}
                                    title={t('Show chat')}
                                    aria-label={t('Show chat')}
                                >
                                    <PanelLeft className="h-4 w-4 rtl:rotate-180" />
                                </Button>
                            )}
                        <div className="flex items-center border rounded-lg overflow-hidden">
                            <button
                                onClick={() => setViewMode('preview')}
                                aria-label={t('Preview')}
                                title={t('Preview')}
                                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all sm:px-4 ${
                                    viewMode === 'preview'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                            >
                                <Eye className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('Preview')}</span>
                            </button>
                            <div className="w-px h-6 bg-border" />
                            <button
                                onClick={() => setViewMode('code')}
                                aria-label={t('Code')}
                                title={t('Code')}
                                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all sm:px-4 ${
                                    viewMode === 'code'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                            >
                                <Code className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('Code')}</span>
                            </button>
                            <div className="w-px h-6 bg-border" />
                            <button
                                onClick={() => setViewMode('settings')}
                                aria-label={t('Settings')}
                                title={t('Settings')}
                                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all sm:px-4 ${
                                    viewMode === 'settings'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                            >
                                <Settings className="h-4 w-4" />
                                <span className="hidden sm:inline">{t('Settings')}</span>
                            </button>
                        </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Preview actions */}
                            {viewMode === 'preview' && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        // triggerBuild's onBuildComplete (handleBuildComplete)
                                        // already plays the build chime and refreshes the
                                        // preview when the build finishes. Doing it here too
                                        // double-fired both — audible as an overlapping sound on
                                        // fast WordPress rebuilds, and a double Playground reboot.
                                        onClick={() => triggerBuild()}
                                        disabled={isBuildingPreview}
                                        className="h-8"
                                        aria-label={t('Rebuild')}
                                        title={t('Rebuild')}
                                    >
                                        {isBuildingPreview ? (
                                            <Loader2 className="h-4 w-4 animate-spin sm:me-1.5" />
                                        ) : (
                                            <Hammer className="h-4 w-4 sm:me-1.5" />
                                        )}
                                        <span className="hidden sm:inline">{t('Rebuild')}</span>
                                    </Button>
                                    {progress.previewUrl && (
                                        project.output_target === 'wordpress_theme' ? (
                                            // WordPress themes aren't hosted websites — the
                                            // deliverable is the installable theme zip, plus a
                                            // full-page Playground preview in a new tab.
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(`/preview/${project.id}/wp-playground`, '_blank')}
                                                    className="h-8"
                                                    title={t('Open the theme in a full-page WordPress preview')}
                                                    aria-label={t('Open')}
                                                >
                                                    <ExternalLink className="h-4 w-4 sm:me-1.5" />
                                                    <span className="hidden sm:inline">{t('Open')}</span>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => { window.location.href = `/preview/${project.id}/wp-theme.zip`; }}
                                                    className="h-8"
                                                    title={t('Download the installable WordPress theme (.zip)')}
                                                    aria-label={t('Download Theme')}
                                                >
                                                    <Download className="h-4 w-4 sm:me-1.5" />
                                                    <span className="hidden sm:inline">{t('Download Theme')}</span>
                                                </Button>
                                            </>
                                        ) : project.output_target === 'shopify_theme' ? (
                                            // Shopify themes are delivered as an installable zip.
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { window.location.href = `/preview/${project.id}/shopify-theme.zip`; }}
                                                className="h-8"
                                                title={t('Download the installable Shopify theme (.zip)')}
                                                aria-label={t('Download Theme')}
                                            >
                                                <Download className="h-4 w-4 sm:me-1.5" />
                                                <span className="hidden sm:inline">{t('Download Theme')}</span>
                                            </Button>
                                        ) : (
                                            <>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => window.open(project.subdomain ? `https://${project.subdomain}.${baseDomain}` : `/app/${project.id}`, '_blank')}
                                                    className="h-8"
                                                    aria-label={t('Open')}
                                                    title={t('Open')}
                                                >
                                                    <ExternalLink className="h-4 w-4 sm:me-1.5" />
                                                    <span className="hidden sm:inline">{t('Open')}</span>
                                                </Button>
                                                {canExportCode && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => { window.location.href = `/builder/projects/${project.id}/export`; }}
                                                        className="h-8"
                                                        title={t('Download the source code (Vercel-ready)')}
                                                        aria-label={t('Export')}
                                                    >
                                                        <Download className="h-4 w-4 sm:me-1.5" />
                                                        <span className="hidden sm:inline">{t('Export')}</span>
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setPublishModalOpen(true)}
                                                    className="h-8"
                                                    aria-label={project.subdomain ? t('Published') : t('Publish')}
                                                    title={project.subdomain ? t('Published') : t('Publish')}
                                                >
                                                    <Globe className="h-4 w-4 sm:me-1.5" />
                                                    <span className="hidden sm:inline">{project.subdomain ? t('Published') : t('Publish')}</span>
                                                </Button>
                                            </>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden">
                        {viewMode === 'settings' ? (
                            <ProjectSettingsPanel
                                project={project}
                                baseDomain={baseDomain}
                                canUseSubdomains={canUseSubdomains}
                                canCreateMoreSubdomains={canCreateMoreSubdomains}
                                canUsePrivateVisibility={canUsePrivateVisibility}
                                subdomainUsage={subdomainUsage}
                                suggestedSubdomain={suggestedSubdomain}
                                storage={storage}
                                customDomain={customDomain}
                                subdomainsGloballyEnabled={subdomainsGloballyEnabled}
                                customDomainsGloballyEnabled={customDomainsGloballyEnabled}
                            />
                        ) : viewMode === 'code' ? (
                            <div className="flex h-full">
                                {/* File Tree */}
                                <div className="w-56 shrink-0 border-e">
                                    <FileTree
                                        projectId={project.id}
                                        onFileSelect={setSelectedFile}
                                        selectedFile={selectedFile}
                                        refreshTrigger={fileRefreshTrigger}
                                    />
                                </div>
                                {/* Code Editor */}
                                <div className="flex-1 overflow-hidden">
                                    <CodeEditor
                                        projectId={project.id}
                                        selectedFile={selectedFile}
                                        onSave={() => setFileRefreshTrigger(tf => tf + 1)}
                                    />
                                </div>
                            </div>
                        ) : project.output_target === 'wordpress_theme' && progress.previewUrl ? (
                            // WordPress block themes render in an in-browser
                            // WordPress (Playground) instead of the React iframe.
                            <WordPressPlaygroundPreview
                                themeZipUrl={`/preview/${project.id}/wp-theme.zip`}
                                projectId={project.id}
                                refreshKey={previewRefreshTrigger}
                                onUndo={handleUndo}
                                onRedo={handleRedo}
                                onRestoreRevision={handleRestoreRevision}
                                isUndoing={isUndoing}
                                isRedoing={isRedoing}
                                isUndoRedoDisabled={isLoading || isRestoring}
                            />
                        ) : project.output_target === 'shopify_theme' ? (
                            // Shopify themes are delivered as an installable zip.
                            // No in-browser preview — show download + store preview
                            // link (if the store domain + pushed theme ID are set).
                            <ShopifyThemePreview
                                projectId={project.id}
                                projectName={project.name}
                                storeDomain={project.shopify_store_domain}
                                themeId={project.shopify_theme_id}
                                hasBuild={!!progress.previewUrl}
                                canConnectStore={canConnectShopify}
                            />
                        ) : (
                            // Single unified preview for preview/inspect/design modes
                            <InspectPreview
                                projectId={project.id}
                                mode={previewSubMode}
                                onModeChange={setPreviewSubMode}
                                previewUrl={progress.previewUrl}
                                outputTarget={project.output_target}
                                refreshTrigger={previewRefreshTrigger}
                                isBuilding={isBuildingPreview}
                                captureThumbnailTrigger={captureThumbnailTrigger}
                                onUndo={handleUndo}
                                onRedo={handleRedo}
                                onRestoreRevision={handleRestoreRevision}
                                isUndoing={isUndoing}
                                isRedoing={isRedoing}
                                isUndoRedoDisabled={isLoading || isRestoring}
                                storageEnabled={!!storage?.enabled}
                                maxFileSizeMb={storage?.maxFileSizeMb ?? 5}
                                onElementSelect={handleElementSelect}
                                onElementEdit={handleElementEdit}
                                pendingEdits={pendingEdits}
                                onSaveAllEdits={handleSaveAllEdits}
                                onDiscardAllEdits={handleDiscardAllEdits}
                                onRemoveEdit={handleRemoveEdit}
                                isSavingTheme={isSavingDesign}
                                onSendStyleEdit={handleSendStyleEdit}
                                onApplyStyleClasses={handleApplyStyleClasses}
                                themeDesignerSlot={
                                    <DesignDesigner
                                        designSystems={designSystems}
                                        currentSystemId={appliedSystemId}
                                        currentAccent={appliedAccent}
                                        onApply={async (systemId, accent) => {
                                            if (isLoading) {
                                                toast.warning(t('A build is already running. Please wait.'));
                                                return;
                                            }
                                            setIsSavingDesign(true);
                                            playSound('build');
                                            try {
                                                const response = await axios.put(`/project/${project.id}/design`, {
                                                    design_system_id: systemId,
                                                    design_accent: accent,
                                                });
                                                if (response.data.success) {
                                                    setAppliedSystemId(systemId);
                                                    setAppliedAccent(accent);
                                                    setCaptureThumbnailTrigger(Date.now());
                                                    // Surface partial-failure warnings (no builder / not built yet
                                                    // / rebuild failed) — already localized server-side.
                                                    if (response.data.warning) {
                                                        toast.warning(response.data.warning as string);
                                                    }
                                                    const fixupPrompt = response.data.ai_fixup_prompt as string | undefined;
                                                    if (fixupPrompt) {
                                                        await sendMessage(fixupPrompt);
                                                    }
                                                }
                                            } catch {
                                                playSound('error');
                                                toast.error(t('Failed to apply design'));
                                            } finally {
                                                setIsSavingDesign(false);
                                            }
                                        }}
                                        isSaving={isSavingDesign}
                                        isBuilding={isLoading}
                                    />
                                }
                            />
                        )}
                    </div>
                </div>
                </div>

                <MobilePaneTabs
                    pane={mobilePane}
                    onChange={handleMobilePaneChange}
                    showPreviewDot={previewDot}
                />
            </div>

            {/* Publish Modal */}
            <PublishModal
                open={publishModalOpen}
                onOpenChange={setPublishModalOpen}
                project={project}
                baseDomain={baseDomain}
                canUseSubdomains={canUseSubdomains}
                canCreateMoreSubdomains={canCreateMoreSubdomains}
                canUsePrivateVisibility={canUsePrivateVisibility}
                suggestedSubdomain={suggestedSubdomain}
                onPublished={(url) => {
                    toast.success(t('Published to :url', { url }));
                }}
            />
        </>
    );
}


