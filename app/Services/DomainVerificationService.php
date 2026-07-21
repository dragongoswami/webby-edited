<?php

namespace App\Services;

use App\Models\Project;

class DomainVerificationService
{
    protected DomainSettingService $settingService;

    protected NotificationService $notificationService;

    public function __construct(DomainSettingService $settingService, NotificationService $notificationService)
    {
        $this->settingService = $settingService;
        $this->notificationService = $notificationService;
    }

    /**
     * Get verification instructions for a project's custom domain.
     * Uses A record verification — user points both the bare domain and the
     * www subdomain to the server IP. Both are required because certbot
     * requests a cert covering bare + www and nginx serves both hostnames.
     */
    public function getVerificationInstructions(Project $project): array
    {
        $serverIp = $this->settingService->getServerIp() ?: 'YOUR_SERVER_IP';
        [$bare, $www] = $this->domainVariants($project->custom_domain ?? '');

        return [
            'method' => 'a_record',
            'records' => [
                ['type' => 'A', 'host' => $bare, 'value' => $serverIp],
                ['type' => 'A', 'host' => $www, 'value' => $serverIp],
            ],
        ];
    }

    /**
     * Verify a project's custom domain via A record lookup.
     *
     * @return array{success: bool, error: ?string}
     */
    public function verify(Project $project): array
    {
        if (! $project->custom_domain) {
            return [
                'success' => false,
                'error' => __('No custom domain configured for this project.'),
            ];
        }

        return $this->verifyARecord($project);
    }

    /**
     * Verify domain by checking that the A records for BOTH the bare domain
     * and the www subdomain point to the configured server IP. Both are
     * required — certbot requests a cert covering both and nginx serves both.
     */
    protected function verifyARecord(Project $project): array
    {
        $serverIp = $this->settingService->getServerIp();

        if (! $serverIp) {
            return [
                'success' => false,
                'error' => __('Server IP not configured. Please contact the administrator.'),
            ];
        }

        $variants = $this->domainVariants($project->custom_domain);
        $missing = [];
        foreach ($variants as $host) {
            if (! $this->checkDnsARecord($host, $serverIp)) {
                $missing[] = $host;
            }
        }

        if (empty($missing)) {
            $wasVerified = (bool) $project->custom_domain_verified;

            $project->update([
                'custom_domain_verified' => true,
                'custom_domain_verified_at' => now(),
                'custom_domain_ssl_status' => $this->settingService->usesLetsEncrypt() ? 'pending' : null,
            ]);

            // Only notify on the first-time transition to verified — retrySsl
            // re-runs verify() and would otherwise spam a notification per retry.
            if ($project->user && ! $wasVerified) {
                $this->notificationService->notifyDomainVerified($project->user, $project);
            }

            return [
                'success' => true,
                'error' => null,
            ];
        }

        $hostList = implode(' and ', $missing);

        return [
            'success' => false,
            'error' => __('A record not found for :host. Please add an A record pointing :host to :ip.', [
                'host' => $hostList,
                'ip' => $serverIp,
            ]),
        ];
    }

    /**
     * Return the bare and www variants for a stored custom domain. Handles
     * inputs that may already include a www. prefix.
     *
     * @return array{0: string, 1: string} [bare, www]
     */
    protected function domainVariants(string $domain): array
    {
        $bare = str_starts_with($domain, 'www.') ? substr($domain, 4) : $domain;

        return [$bare, "www.{$bare}"];
    }

    /**
     * Check if domain has an A record pointing to the expected IP.
     */
    protected function checkDnsARecord(string $domain, string $expectedIp): bool
    {
        try {
            $records = dns_get_record($domain, DNS_A);

            if (! $records) {
                return false;
            }

            $expectedIp = trim($expectedIp);

            foreach ($records as $record) {
                if (isset($record['ip']) && trim($record['ip']) === $expectedIp) {
                    return true;
                }
            }

            return false;
        } catch (\Exception $e) {
            return false;
        }
    }
}
