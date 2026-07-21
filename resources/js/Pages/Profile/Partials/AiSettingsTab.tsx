import { useState, useEffect } from 'react';
import { useForm, router } from '@inertiajs/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Trash2,
    Check,
    Loader2,
    AlertCircle,
    Zap,
    Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import SoundSettingsCard from './SoundSettingsCard';
import { SoundSettings, SoundStyle } from '@/hooks/useChatSounds';
import { useTranslation } from '@/contexts/LanguageContext';

interface AiSettingsTabProps {
    settings: {
        preferred_provider: string;
        preferred_model: string | null;
        has_openai_key: boolean;
        openai_key_masked: string | null;
        has_anthropic_key?: boolean;
        anthropic_key_masked?: string | null;
        has_grok_key?: boolean;
        grok_key_masked?: string | null;
        has_deepseek_key?: boolean;
        deepseek_key_masked?: string | null;
        has_zhipu_key?: boolean;
        zhipu_key_masked?: string | null;
        has_ollama_key?: boolean;
        ollama_key_masked?: string | null;
        has_openrouter_key?: boolean;
        openrouter_key_masked?: string | null;
    } | null;
    canUseOwnKey: boolean;
    isUsingOwnKey: boolean;
    providerTypes: Record<string, string>;
    defaultModels: Record<string, string[]>;
    soundSettings: SoundSettings;
    soundStyles: SoundStyle[];
}

export default function AiSettingsTab({
    settings,
    canUseOwnKey,
    isUsingOwnKey,
    providerTypes,
    defaultModels,
    soundSettings,
    soundStyles,
}: AiSettingsTabProps) {
    const { t } = useTranslation();
    const [testingProvider, setTestingProvider] = useState<string | null>(null);
    const [removeKeyTarget, setRemoveKeyTarget] = useState<string | null>(null);

    const { data, setData, put, processing, errors } = useForm({
        preferred_provider: settings?.preferred_provider ?? 'system',
        preferred_model: settings?.preferred_model ?? '',
        openai_api_key: '',
        anthropic_api_key: '',
        grok_api_key: '',
        deepseek_api_key: '',
        zhipu_api_key: '',
        ollama_api_key: '',
        openrouter_api_key: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put('/profile/ai-settings', {
            onSuccess: () => {
                toast.success(t('AI settings updated successfully'));
                setData({
                    ...data,
                    openai_api_key: '',
                    anthropic_api_key: '',
                    grok_api_key: '',
                    deepseek_api_key: '',
                    zhipu_api_key: '',
                    ollama_api_key: '',
                    openrouter_api_key: '',
                });
            },
            onError: () => {
                toast.error(t('Failed to update settings'));
            },
        });
    };

    const handleTestConnection = async (provider: string, apiKey: string) => {
        if (!apiKey) {
            toast.error(t('Please enter an API key first'));
            return;
        }

        setTestingProvider(provider);

        try {
            const response = await fetch('/profile/ai-settings/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ provider, api_key: apiKey }),
            });

            const result = await response.json();

            if (result.success) {
                toast.success(t('Connection successful!'));
            } else {
                toast.error(result.message || t('Connection failed'));
            }
        } catch {
            toast.error(t('Failed to test connection'));
        } finally {
            setTestingProvider(null);
        }
    };

    const handleRemoveKey = (provider: string) => {
        setRemoveKeyTarget(provider);
    };

    const confirmRemoveKey = () => {
        if (!removeKeyTarget) return;
        const provider = removeKeyTarget;
        router.post('/profile/ai-settings/remove-key', { provider }, {
            onSuccess: () => {
                toast.success(t('API key removed'));
                setRemoveKeyTarget(null);
            },
            onError: () => {
                toast.error(t('Failed to remove API key'));
            },
        });
    };

    const hasKeyFor = (provider: string) => {
        if (provider === 'openai') return settings?.has_openai_key;
        if (provider === 'anthropic') return settings?.has_anthropic_key;
        if (provider === 'grok') return settings?.has_grok_key;
        if (provider === 'deepseek') return settings?.has_deepseek_key;
        if (provider === 'zhipu') return settings?.has_zhipu_key;
        if (provider === 'ollama') return settings?.has_ollama_key;
        if (provider === 'openrouter') return settings?.has_openrouter_key;
        return false;
    };

    const getMaskedKeyFor = (provider: string) => {
        if (provider === 'openai') return settings?.openai_key_masked;
        if (provider === 'anthropic') return settings?.anthropic_key_masked;
        if (provider === 'grok') return settings?.grok_key_masked;
        if (provider === 'deepseek') return settings?.deepseek_key_masked;
        if (provider === 'zhipu') return settings?.zhipu_key_masked;
        if (provider === 'ollama') return settings?.ollama_key_masked;
        if (provider === 'openrouter') return settings?.openrouter_key_masked;
        return null;
    };

    const getApiKeyField = (provider: string) => {
        if (provider === 'openai') return 'openai_api_key';
        if (provider === 'anthropic') return 'anthropic_api_key';
        if (provider === 'grok') return 'grok_api_key';
        if (provider === 'deepseek') return 'deepseek_api_key';
        if (provider === 'zhipu') return 'zhipu_api_key';
        if (provider === 'ollama') return 'ollama_api_key';
        if (provider === 'openrouter') return 'openrouter_api_key';
        return '';
    };

    const availableModels = data.preferred_provider !== 'system'
        ? defaultModels[data.preferred_provider] || []
        : [];

    // Auto-select first model when provider changes
    useEffect(() => {
        if (data.preferred_provider !== 'system') {
            const models = defaultModels[data.preferred_provider] || [];
            if (models.length > 0 && !models.includes(data.preferred_model)) {
                setData('preferred_model', models[0]);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.preferred_provider]);

    if (!canUseOwnKey) {
        return (
            <div className="space-y-6">
                {/* API Keys - Not available */}
                <div className="bg-card p-4 shadow-sm border border-border rounded-lg sm:p-8">
                    <section>
                        <header>
                            <h2 className="text-lg font-medium text-foreground">
                                {t('Your API Keys')}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t('Use your own AI provider API keys to avoid credit deductions.')}
                            </p>
                        </header>

                        <div className="mt-6 text-center py-6">
                            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                            <h4 className="font-medium mb-2">{t('Not Available on Your Plan')}</h4>
                            <p className="text-sm text-muted-foreground mb-4">
                                {t('Upgrade to use your own API keys.')}
                            </p>
                            <Button asChild size="sm">
                                <a href="/billing">{t('View Plans')}</a>
                            </Button>
                        </div>
                    </section>
                </div>

                {/* Chat Sounds */}
                <div className="bg-card p-4 shadow-sm border border-border rounded-lg sm:p-8">
                    <SoundSettingsCard
                        settings={soundSettings}
                        soundStyles={soundStyles}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* API Keys Section */}
            <div className="bg-card p-4 shadow-sm border border-border rounded-lg sm:p-8">
                <section>
                    <header>
                        <h2 className="text-lg font-medium text-foreground">
                            {t('Your API Keys')}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('Use your own AI provider API keys to avoid credit deductions.')}
                        </p>
                    </header>

                    {/* Status Banner */}
                    <Alert className="mt-6">
                        <Bot className="h-4 w-4" />
                        <AlertDescription className="flex items-center justify-between">
                            <span>
                                {t('You are currently using')}{' '}
                                <strong>{isUsingOwnKey ? t('your own API key') : t('system AI')}</strong>
                            </span>
                            {isUsingOwnKey && (
                                <Badge variant="outline" className="ms-2">
                                    {t('Credits not deducted')}
                                </Badge>
                            )}
                        </AlertDescription>
                    </Alert>

                    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                        {/* Provider Selection */}
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="preferred_provider">{t('Provider')}</Label>
                                <Select
                                    value={data.preferred_provider}
                                    onValueChange={(value) => setData('preferred_provider', value)}
                                >
                                    <SelectTrigger id="preferred_provider">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="system">{t('Use System Default')}</SelectItem>
                                        {Object.entries(providerTypes).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>
                                                <span className="flex items-center gap-2">
                                                    {label}
                                                    {hasKeyFor(key) && (
                                                        <Check className="h-3 w-3 text-success" />
                                                    )}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.preferred_provider && (
                                    <p className="text-sm text-destructive">{errors.preferred_provider}</p>
                                )}
                            </div>

                            {data.preferred_provider !== 'system' && availableModels.length > 0 && (
                                <div className="space-y-2">
                                    <Label htmlFor="preferred_model">{t('Model')}</Label>
                                    <Select
                                        value={data.preferred_model}
                                        onValueChange={(value) => setData('preferred_model', value)}
                                    >
                                        <SelectTrigger id="preferred_model">
                                            <SelectValue placeholder={t('Select a model')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableModels.map((model) => (
                                                <SelectItem key={model} value={model}>
                                                    {model}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* API Keys */}
                        <div className="space-y-4 pt-4 border-t">
                            <h3 className="text-sm font-medium text-foreground">{t('API Keys')}</h3>
                            <p className="text-sm text-muted-foreground">
                                {t('Enter your API keys for the providers you want to use. Keys are encrypted and stored securely.')}
                            </p>

                            <div className="space-y-6">
                                {Object.entries(providerTypes).map(([provider, label]) => (
                                    <div key={provider} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor={`api-key-${provider}`} className="flex items-center gap-2">
                                                {label}
                                                {hasKeyFor(provider) && (
                                                    <Badge variant="outline" className="ms-2 gap-1">
                                                        <Check className="h-3 w-3" />
                                                        {t('Configured')}
                                                    </Badge>
                                                )}
                                            </Label>
                                            {hasKeyFor(provider) && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleRemoveKey(provider)}
                                                    className="text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </div>
                                        {hasKeyFor(provider) && (
                                            <p className="text-xs text-muted-foreground">
                                                {t('Current')}: {getMaskedKeyFor(provider)}
                                            </p>
                                        )}

                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <PasswordInput
                                                    id={`api-key-${provider}`}
                                                    revealLabel={t('Show password')}
                                                    hideLabel={t('Hide password')}
                                                    placeholder={hasKeyFor(provider) ? t('Enter new key to replace') : t('Enter API key')}
                                                    value={data[getApiKeyField(provider) as keyof typeof data]}
                                                    onChange={(e) =>
                                                        setData(getApiKeyField(provider) as keyof typeof data, e.target.value)
                                                    }
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() =>
                                                    handleTestConnection(
                                                        provider,
                                                        data[getApiKeyField(provider) as keyof typeof data]
                                                    )
                                                }
                                                disabled={
                                                    testingProvider === provider ||
                                                    !data[getApiKeyField(provider) as keyof typeof data]
                                                }
                                            >
                                                {testingProvider === provider ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Zap className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button type="submit" disabled={processing}>
                                {processing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                {t('Save Settings')}
                            </Button>
                        </div>
                    </form>
                </section>
            </div>

            {/* Chat Sounds Section */}
            <div className="bg-card p-4 shadow-sm border border-border rounded-lg sm:p-8">
                <SoundSettingsCard
                    settings={soundSettings}
                    soundStyles={soundStyles}
                />
            </div>

            <AlertDialog open={removeKeyTarget !== null} onOpenChange={(open) => !open && setRemoveKeyTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t('Are you sure you want to remove your :provider API key?', {
                                provider: removeKeyTarget ? providerTypes[removeKeyTarget] : '',
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('This action cannot be undone.')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemoveKey}
                            className={buttonVariants({ variant: 'destructive' })}
                        >
                            {t('Remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
