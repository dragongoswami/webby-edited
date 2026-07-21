<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Services\DomainSettingService;
use App\Services\DomainVerificationService;
use App\Support\CustomDomainHelper;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class ProjectCustomDomainController extends Controller
{
    protected DomainSettingService $settingService;

    protected DomainVerificationService $verificationService;

    public function __construct(
        DomainSettingService $settingService,
        DomainVerificationService $verificationService
    ) {
        $this->settingService = $settingService;
        $this->verificationService = $verificationService;
    }

    /**
     * Check if a domain is available.
     */
    public function checkAvailability(Request $request): JsonResponse
    {
        // Check if custom domains are enabled globally
        if (! $this->settingService->isCustomDomainsEnabled()) {
            return response()->json([
                'available' => false,
                'error' => __('Custom domains are not enabled on this platform.'),
            ], 403);
        }

        $request->validate([
            'domain' => 'required|string|max:255',
            'exclude_project_id' => 'nullable|string',
        ]);

        $domain = CustomDomainHelper::normalize($request->input('domain'));

        // Validate format
        $errors = CustomDomainHelper::validate($domain);
        if (! empty($errors)) {
            return response()->json([
                'available' => false,
                'error' => $errors[0],
            ]);
        }

        // Check if domain is a subdomain of the base domain (not allowed)
        $baseDomain = $this->settingService->getBaseDomain();
        if ($baseDomain && CustomDomainHelper::isSubdomainOfBase($domain, $baseDomain)) {
            return response()->json([
                'available' => false,
                'error' => __('You cannot use the platform base domain as a custom domain.'),
            ]);
        }

        // Check availability
        $excludeId = $request->input('exclude_project_id');
        $available = CustomDomainHelper::isAvailable($domain, $excludeId);

        return response()->json([
            'available' => $available,
            'error' => $available ? null : 'This domain is already in use.',
        ]);
    }

    /**
     * Store a custom domain for a project.
     */
    public function store(Request $request, Project $project): JsonResponse
    {
        // Authorize access
        $this->authorize('update', $project);

        // WordPress theme projects are downloadable artifacts — nothing is
        // hosted, so a custom domain cannot apply.
        if ($project->isWordPressTheme()) {
            return response()->json([
                'success' => false,
                'error' => __('WordPress theme projects cannot be published. Download the theme and install it on your WordPress site instead.'),
            ], 403);
        }

        // Shopify theme projects are downloadable artifacts — they are
        // installed on the user's Shopify store, not hosted here.
        if ($project->isShopifyTheme()) {
            return response()->json([
                'success' => false,
                'error' => __('Shopify theme projects cannot be published. Download the theme and install it on your Shopify store instead.'),
            ], 403);
        }

        // Check if custom domains are enabled globally
        if (! $this->settingService->isCustomDomainsEnabled()) {
            return response()->json([
                'success' => false,
                'error' => __('Custom domains are not enabled on this platform.'),
            ], 403);
        }

        // Check if user can use custom domains
        $user = $request->user();
        if (! $user->canUseCustomDomains()) {
            return response()->json([
                'success' => false,
                'error' => __('Your plan does not include custom domain publishing.'),
            ], 403);
        }

        // Check if user can create more custom domains
        if (! $user->canCreateMoreCustomDomains() && ! $project->custom_domain) {
            return response()->json([
                'success' => false,
                'error' => __('You have reached your custom domain limit.'),
            ], 403);
        }

        $request->validate([
            'domain' => 'required|string|max:255',
        ]);

        $domain = CustomDomainHelper::normalize($request->input('domain'));

        // Validate format
        $errors = CustomDomainHelper::validate($domain);
        if (! empty($errors)) {
            return response()->json([
                'success' => false,
                'error' => $errors[0],
            ], 422);
        }

        // Check if domain is a subdomain of the base domain
        $baseDomain = $this->settingService->getBaseDomain();
        if ($baseDomain && CustomDomainHelper::isSubdomainOfBase($domain, $baseDomain)) {
            return response()->json([
                'success' => false,
                'error' => __('You cannot use the platform base domain as a custom domain.'),
            ], 422);
        }

        // Check availability
        if (! CustomDomainHelper::isAvailable($domain, $project->id)) {
            return response()->json([
                'success' => false,
                'error' => __('This domain is already in use.'),
            ], 422);
        }

        // Update project
        try {
            $project->update([
                'custom_domain' => $domain,
                'custom_domain_verified' => false,
                'custom_domain_ssl_status' => null,
                'custom_domain_verified_at' => null,
            ]);
        } catch (UniqueConstraintViolationException) {
            return response()->json([
                'success' => false,
                'error' => __('This domain was just taken. Please try a different one.'),
            ], 409);
        }

        // Auto-attempt verification — if DNS already points to this server
        // (common when reassigning a domain between projects), the domain
        // gets verified immediately without requiring a manual verify step.
        try {
            $this->verificationService->verify($project->fresh());
        } catch (\Throwable $e) {
            Log::warning('Domain auto-verification failed', [
                'domain' => $domain,
                'error' => $e->getMessage(),
            ]);
        }
        $project->refresh();

        return response()->json([
            'success' => true,
            'domain' => $domain,
            'verified' => $project->custom_domain_verified,
            'verification' => $project->custom_domain_verified
                ? null
                : $this->verificationService->getVerificationInstructions($project),
        ]);
    }

    /**
     * Verify a project's custom domain.
     */
    public function verify(Project $project): JsonResponse
    {
        // Authorize access
        $this->authorize('update', $project);

        if (! $project->custom_domain) {
            return response()->json([
                'success' => false,
                'error' => __('No custom domain configured for this project.'),
            ], 422);
        }

        if ($project->custom_domain_verified) {
            return response()->json([
                'success' => true,
                'already_verified' => true,
                'message' => __('Domain is already verified.'),
            ]);
        }

        $result = $this->verificationService->verify($project);

        if ($result['success']) {
            return response()->json([
                'success' => true,
                'message' => __('Domain verified successfully.'),
            ]);
        }

        return response()->json([
            'success' => false,
            'error' => $result['error'],
        ], 422);
    }

    /**
     * Get verification instructions for a project's custom domain.
     */
    public function instructions(Project $project): JsonResponse
    {
        // Authorize access
        $this->authorize('view', $project);

        if (! $project->custom_domain) {
            return response()->json([
                'success' => false,
                'error' => __('No custom domain configured for this project.'),
            ], 422);
        }

        $instructions = $this->verificationService->getVerificationInstructions($project);

        return response()->json([
            'success' => true,
            'instructions' => $instructions,
            'verified' => $project->custom_domain_verified,
            'ssl_status' => $project->custom_domain_ssl_status,
        ]);
    }

    /**
     * Remove a custom domain from a project.
     */
    public function destroy(Project $project): JsonResponse
    {
        // Authorize access
        $this->authorize('update', $project);

        if (! $project->custom_domain) {
            return response()->json([
                'success' => false,
                'error' => __('No custom domain configured for this project.'),
            ], 422);
        }

        $domain = $project->custom_domain;
        $bareDomain = str_starts_with($domain, 'www.') ? substr($domain, 4) : $domain;
        $configFile = "webby-{$bareDomain}.conf";

        // Best-effort nginx config cleanup (ignore result — file may not exist)
        Process::run(['sudo', 'rm', "/etc/nginx/sites-enabled/{$configFile}"]);
        Process::run(['sudo', 'rm', "/etc/nginx/sites-available/{$configFile}"]);
        Process::run(['sudo', 'nginx', '-s', 'reload']);

        $project->update([
            'custom_domain' => null,
            'custom_domain_verified' => false,
            'custom_domain_ssl_status' => null,
            'custom_domain_verified_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => __('Custom domain removed successfully.'),
        ]);
    }

    /**
     * Retry SSL provisioning for a project's custom domain.
     */
    public function retrySsl(Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        if (! $project->custom_domain) {
            return response()->json([
                'success' => false,
                'error' => __('No custom domain configured for this project.'),
            ], 422);
        }

        if ($project->custom_domain_ssl_status !== 'failed') {
            return response()->json([
                'success' => false,
                'error' => __('SSL provisioning can only be retried when it has failed.'),
            ], 422);
        }

        // Re-verify DNS before queueing another certbot attempt. Most failures
        // trace back to a missing www A record; short-circuiting here surfaces
        // the specific missing host instead of looping through certbot again.
        $verifyResult = $this->verificationService->verify($project);
        if (! $verifyResult['success']) {
            return response()->json([
                'success' => false,
                'error' => $verifyResult['error'],
            ], 422);
        }

        // DNS is good — clean up any partial nginx config from the failed attempt
        $domain = $project->custom_domain;
        $bareDomain = str_starts_with($domain, 'www.') ? substr($domain, 4) : $domain;
        $configFile = "webby-{$bareDomain}.conf";
        Process::run(['sudo', 'rm', "/etc/nginx/sites-enabled/{$configFile}"]);
        Process::run(['sudo', 'rm', "/etc/nginx/sites-available/{$configFile}"]);
        Process::run(['sudo', 'nginx', '-s', 'reload']);

        $project->update([
            'custom_domain_ssl_status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => __('SSL provisioning has been queued for retry. This usually completes within a few minutes.'),
        ]);
    }
}
