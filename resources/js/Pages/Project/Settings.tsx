import { Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProjectSettingsPanel } from '@/components/Project/ProjectSettingsPanel';
import { useTranslation } from '@/contexts/LanguageContext';

interface Project {
    id: string;
    name: string;
    subdomain: string | null;
    published_title: string | null;
    published_description: string | null;
    published_visibility: string;
    share_image: string | null;
    custom_instructions: string | null;
    api_token: string | null;
    custom_domain: string | null;
    custom_domain_verified: boolean;
    custom_domain_ssl_status: string | null;
    output_target?: 'website' | 'wordpress_theme';
    supabase_connection_id?: number | null;
}

interface SubdomainUsage {
    used: number;
    limit: number | null;
    unlimited: boolean;
    remaining: number;
}

interface StorageSettings {
    enabled: boolean;
    usedBytes: number;
    limitMb: number | null;
    unlimited: boolean;
}

interface CustomDomainUsage {
    used: number;
    limit: number | null;
    unlimited: boolean;
    remaining: number;
}

interface CustomDomainSettings {
    enabled: boolean;
    canCreateMore: boolean;
    usage: CustomDomainUsage;
    baseDomain: string | null;
}

interface SettingsProps {
    project: Project;
    baseDomain: string;
    canUseSubdomains: boolean;
    canCreateMoreSubdomains: boolean;
    canUsePrivateVisibility: boolean;
    subdomainUsage: SubdomainUsage;
    suggestedSubdomain: string;
    storage?: StorageSettings;
    customDomain?: CustomDomainSettings;
    subdomainsGloballyEnabled?: boolean;
    customDomainsGloballyEnabled?: boolean;
}

export default function Settings({
    project,
    baseDomain,
    canUseSubdomains,
    canCreateMoreSubdomains,
    canUsePrivateVisibility,
    subdomainUsage,
    suggestedSubdomain,
    storage,
    customDomain,
    subdomainsGloballyEnabled,
    customDomainsGloballyEnabled,
}: SettingsProps) {
    const { t } = useTranslation();

    return (
        <>
            <Head title={t('Settings - :name', { name: project.name })} />

            <div className="h-dvh bg-background flex flex-col">
                {/* Header */}
                <div className="h-14 px-4 border-b flex items-center justify-between bg-background shrink-0">
                    <div>
                        <h1 className="text-sm font-semibold">{project.name}</h1>
                        <p className="text-xs text-muted-foreground">{t('Project Settings')}</p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/project/${project.id}`}>
                            <ArrowLeft className="h-4 w-4 me-2" />
                            {t('Back')}
                        </Link>
                    </Button>
                </div>

                {/* Shared settings panel */}
                <div className="flex-1 overflow-hidden">
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
                </div>
            </div>
        </>
    );
}
