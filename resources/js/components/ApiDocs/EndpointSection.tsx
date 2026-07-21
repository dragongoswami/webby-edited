import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/contexts/LanguageContext';
import { type ApiEndpoint } from '@/lib/apiCatalog';
import { CodeBlock } from './CodeBlock';
import { CodeSamples } from './CodeSamples';
import { EndpointTester } from './EndpointTester';

interface EndpointSectionProps {
    endpoint: ApiEndpoint;
    baseUrl: string;
    apiKey: string;
}

export function EndpointSection({ endpoint, baseUrl, apiKey }: EndpointSectionProps) {
    const { t } = useTranslation();
    const [paramValues, setParamValues] = useState<Record<string, string>>({});

    return (
        <Card id={`endpoint-${endpoint.id}`}>
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    <Badge variant="outline" className="font-mono">{endpoint.method}</Badge>
                    <code className="font-mono text-sm">{endpoint.path}</code>
                    <span aria-hidden="true" className="text-muted-foreground font-normal">—</span>
                    <span className="text-muted-foreground font-normal"><bdi>{t(endpoint.titleKey)}</bdi></span>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t(endpoint.descriptionKey)}</p>
            </CardHeader>
            <CardContent className="space-y-5">
                {endpoint.params.length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold mb-2">{t('Parameters')}</h4>
                        <div className="rounded-md border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="px-3 py-2 text-start font-medium">{t('Parameter')}</th>
                                        <th className="px-3 py-2 text-start font-medium">{t('Type')}</th>
                                        <th className="px-3 py-2 text-start font-medium">{t('Required')}</th>
                                        <th className="px-3 py-2 text-start font-medium">{t('Description')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {endpoint.params.map((param) => (
                                        <tr key={param.name} className="border-b last:border-0">
                                            <td className="px-3 py-2 font-mono text-xs">{param.name}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{param.type}</td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {param.required ? t('Required') : t('Optional')}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground">
                                                {t(param.descriptionKey)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div>
                    <h4 className="text-sm font-semibold mb-2">{t('Example response')}</h4>
                    <CodeBlock code={JSON.stringify(endpoint.sampleResponse, null, 2)} language="json" wrap className="max-h-72" />
                </div>

                <div>
                    <h4 className="text-sm font-semibold mb-2">{t('Code samples')}</h4>
                    <CodeSamples endpoint={endpoint} baseUrl={baseUrl} apiKey={apiKey} paramValues={paramValues} />
                </div>

                <div>
                    <h4 className="text-sm font-semibold mb-2">{t('Try it')}</h4>
                    <EndpointTester endpoint={endpoint} baseUrl={baseUrl} apiKey={apiKey} paramValues={paramValues} onParamChange={setParamValues} />
                </div>
            </CardContent>
        </Card>
    );
}
