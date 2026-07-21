import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Copy } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { type ApiEndpoint } from '@/lib/apiCatalog';
import { generateSnippet, SNIPPET_LABELS, SNIPPET_LANGS, type SnippetLang } from '@/lib/apiSnippets';
import { CodeBlock, type CodeLanguage } from './CodeBlock';

const PRISM_LANG: Record<SnippetLang, CodeLanguage> = {
    curl: 'bash',
    javascript: 'javascript',
    php: 'php',
    python: 'python',
};

interface CodeSamplesProps {
    endpoint: ApiEndpoint;
    baseUrl: string;
    apiKey: string;
    paramValues: Record<string, string>;
}

export function CodeSamples({ endpoint, baseUrl, apiKey, paramValues }: CodeSamplesProps) {
    const { t } = useTranslation();
    const [copiedLang, setCopiedLang] = useState<SnippetLang | null>(null);

    const copySnippet = async (lang: SnippetLang, snippet: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(snippet);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = snippet;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopiedLang(lang);
            setTimeout(() => setCopiedLang(null), 2000);
        } catch {
            // Snippet text remains selectable for manual copying.
        }
    };

    return (
        <>
            <Tabs defaultValue="curl">
                <div className="overflow-x-auto">
                    <TabsList>
                        {SNIPPET_LANGS.map((lang) => (
                            <TabsTrigger key={lang} value={lang}>
                                {SNIPPET_LABELS[lang]}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </div>
                {SNIPPET_LANGS.map((lang) => {
                    const snippet = generateSnippet(lang, endpoint, baseUrl, paramValues, apiKey || undefined);
                    return (
                        <TabsContent key={lang} value={lang}>
                            <div className="relative">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="absolute top-2 end-2"
                                    onClick={() => copySnippet(lang, snippet)}
                                >
                                    {copiedLang === lang ? (
                                        <Check className="h-4 w-4 me-2" />
                                    ) : (
                                        <Copy className="h-4 w-4 me-2" />
                                    )}
                                    {copiedLang === lang ? t('Copied!') : t('Copy')}
                                </Button>
                                <CodeBlock code={snippet} language={PRISM_LANG[lang]} className="pe-24" />
                            </div>
                        </TabsContent>
                    );
                })}
            </Tabs>
            {apiKey.trim() !== '' && (
                <p className="text-xs text-muted-foreground mt-2">
                    {t('Code samples include your API key — be careful where you paste them.')}
                </p>
            )}
        </>
    );
}
