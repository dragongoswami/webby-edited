<?php

namespace App\Http\Middleware;

use App\Http\Controllers\PublishedProjectController;
use App\Models\Project;
use App\Models\SystemSetting;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IdentifyProjectByCustomDomain
{
    public function handle(Request $request, Closure $next): Response
    {
        // Check if custom domains are enabled globally
        if (! SystemSetting::get('domain_enable_custom_domains', false)) {
            return $next($request);
        }

        $host = strtolower($request->getHost());

        // Always skip the application's own domain (APP_URL host) so it is never
        // treated as a custom project domain — even when a separate base domain
        // is configured for publishing (e.g. the app runs on app.example.com
        // while published sites live on *.example.app). Without this, every
        // request to the app's own domain would fall through to the custom-domain
        // lookup below and 404 the entire platform.
        $appHost = strtolower(parse_url(config('app.url', ''), PHP_URL_HOST) ?? '');

        if ($appHost && ($host === $appHost || $host === "www.{$appHost}" || str_ends_with($host, ".{$appHost}"))) {
            return $next($request);
        }

        $baseDomain = SystemSetting::get('domain_base_domain');

        // Skip if host is the base domain or a subdomain of it
        if ($baseDomain) {
            $baseDomain = strtolower($baseDomain);

            // Skip if exact match with base domain
            if ($host === $baseDomain || $host === "www.{$baseDomain}") {
                return $next($request);
            }

            // Skip if it's a subdomain of the base domain
            if (str_ends_with($host, ".{$baseDomain}")) {
                return $next($request);
            }
        }

        // Skip common localhost variants and IP addresses
        if (in_array($host, ['localhost', '127.0.0.1', '::1']) || str_ends_with($host, '.localhost')) {
            return $next($request);
        }

        // Skip IP addresses — custom domains are always domain names
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return $next($request);
        }

        // Normalize host for lookup: strip www. prefix so both www and bare
        // variants resolve to the same project regardless of how it was stored
        $bareHost = str_starts_with($host, 'www.') ? substr($host, 4) : $host;

        // Look up project by custom domain (match both bare and www variants)
        $project = Project::whereIn('custom_domain', [$bareHost, "www.{$bareHost}"])
            ->where('custom_domain_verified', true)
            ->whereNotNull('published_at')
            ->first();

        if (! $project) {
            // No matching project found for this domain
            abort(404, 'Site not found');
        }

        // Check visibility
        if ($project->published_visibility === 'private') {
            $user = $request->user();

            if (! $user || $user->id !== $project->user_id) {
                abort(403, 'This site is private');
            }
        }

        $request->attributes->set('custom_domain_project', $project);

        $path = ltrim($request->getPathInfo(), '/') ?: 'index.html';

        return app(PublishedProjectController::class)->serve($request, $path);
    }
}
