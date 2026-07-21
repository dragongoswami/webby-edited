import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { type ApiEndpoint, buildUrl } from '@/lib/apiCatalog';
import { CodeBlock } from './CodeBlock';

interface EndpointTesterProps {
    endpoint: ApiEndpoint;
    baseUrl: string;
    apiKey: string;
    paramValues: Record<string, string>;
    onParamChange: (values: Record<string, string>) => void;
}

interface TestResult {
    status: number;
    rateLimit: string | null;
    body: string;
}

/**
 * Live "Try it" panel: fires a real same-origin request against /api/v1 with
 * the page-level key. Real rate limits apply; error responses are shown too.
 */
export function EndpointTester({ endpoint, baseUrl, apiKey, paramValues, onParamChange }: EndpointTesterProps) {
    const { t } = useTranslation();
    const [sending, setSending] = useState(false);
    const [needsKey, setNeedsKey] = useState(false);
    const [missingParams, setMissingParams] = useState(false);
    const [result, setResult] = useState<TestResult | null>(null);

    const send = async () => {
        if (apiKey.trim() === '') {
            setNeedsKey(true);
            return;
        }
        setNeedsKey(false);

        // Don't send with an unfilled {placeholder} path param — that hits the
        // route with a literal "{id}" and returns a confusing not-found error.
        const hasMissingPathParam = endpoint.params.some(
            (param) => param.in === 'path' && param.required && (paramValues[param.name] ?? '').trim() === '',
        );
        if (hasMissingPathParam) {
            setMissingParams(true);
            return;
        }
        setMissingParams(false);
        setSending(true);
        setResult(null);

        try {
            const response = await fetch(buildUrl(baseUrl, endpoint, paramValues), {
                headers: {
                    Authorization: `Bearer ${apiKey.trim()}`,
                    Accept: 'application/json',
                },
            });
            const raw = await response.text();
            let body = raw;
            try {
                body = JSON.stringify(JSON.parse(raw), null, 2);
            } catch {
                // Leave non-JSON bodies as-is.
            }
            setResult({
                status: response.status,
                rateLimit: response.headers.get('X-RateLimit-Remaining'),
                body,
            });
        } catch (error) {
            setResult({
                status: 0,
                rateLimit: null,
                body: String(error),
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-3">
            {endpoint.params.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                    {endpoint.params.map((param) => (
                        <div key={param.name} className="space-y-1">
                            <Label htmlFor={`${endpoint.id}_${param.name}`} className="font-mono text-xs">
                                {param.name}
                            </Label>
                            <Input
                                id={`${endpoint.id}_${param.name}`}
                                value={paramValues[param.name] ?? ''}
                                onChange={(e) =>
                                    onParamChange({ ...paramValues, [param.name]: e.target.value })
                                }
                                placeholder={param.example ?? ''}
                            />
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center gap-3">
                <Button type="button" size="sm" onClick={send} disabled={sending}>
                    {sending ? (
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    ) : (
                        <Play className="h-4 w-4 me-2" />
                    )}
                    {sending ? t('Sending...') : t('Send request')}
                </Button>
                {needsKey && (
                    <p className="text-sm text-destructive">
                        {t('Enter your API key above to send a test request.')}
                    </p>
                )}
                {missingParams && (
                    <p className="text-sm text-destructive">
                        {t('Fill in the required parameters before sending.')}
                    </p>
                )}
            </div>

            {result && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t('Status')}:</span>
                        <Badge variant={result.status >= 200 && result.status < 300 ? 'default' : 'destructive'}>
                            {result.status}
                        </Badge>
                        {result.rateLimit !== null && (
                            <span className="text-xs text-muted-foreground font-mono">
                                X-RateLimit-Remaining: {result.rateLimit}
                            </span>
                        )}
                    </div>
                    <CodeBlock code={result.body} language="json" wrap className="max-h-80" />
                </div>
            )}
        </div>
    );
}
