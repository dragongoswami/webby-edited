<?php

use App\Http\Middleware\CheckRegistrationEnabled;
use App\Http\Middleware\EnsureAdminAccess;
use App\Http\Middleware\EnsureApiEnabled;
use App\Http\Middleware\EnsureSupportTicketsEnabled;
use App\Http\Middleware\ForceJsonResponse;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\IdentifyProjectByCustomDomain;
use App\Http\Middleware\IdentifyProjectBySubdomain;
use App\Http\Middleware\Installed;
use App\Http\Middleware\NotInstalled;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\VerifyProjectToken;
use App\Http\Middleware\VerifyServerKey;
use App\Services\SentryReporterService;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            IdentifyProjectBySubdomain::class,
            IdentifyProjectByCustomDomain::class,
            SetLocale::class, // Must run before HandleInertiaRequests to set locale for translations
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        // Prepend ForceJsonResponse to the api group so it runs before any auth middleware,
        // even after Laravel's middleware priority sorting. This ensures auth failures on
        // /api/* routes return 401 JSON rather than a redirect-to-login.
        $middleware->api(prepend: [ForceJsonResponse::class]);

        $middleware->alias([
            'admin' => EnsureAdminAccess::class,
            'registration.enabled' => CheckRegistrationEnabled::class,
            'verify.server.key' => VerifyServerKey::class,
            'verify.project.token' => VerifyProjectToken::class,
            'subdomain.project' => IdentifyProjectBySubdomain::class,
            'custom.domain' => IdentifyProjectByCustomDomain::class,
            'set.locale' => SetLocale::class,
            'not-installed' => NotInstalled::class,
            'installed' => Installed::class,
            'support.enabled' => EnsureSupportTicketsEnabled::class,
            'abilities' => CheckAbilities::class,
            'api.enabled' => EnsureApiEnabled::class,
            'force.json' => ForceJsonResponse::class,
        ]);

        $middleware->validateCsrfTokens(except: [
            'payment-gateways/*/webhook',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->report(function (Throwable $e) {
            app(SentryReporterService::class)->buffer($e);
        });

        $exceptions->render(function (Throwable $e, Request $request) {
            if (headers_sent()) {
                $safeMessage = str_replace(["\n", "\r"], ' ', $e->getMessage());
                error_log('[webby] suppressed render after headers sent: '.$e::class.': '.$safeMessage);

                return response('', 500);
            }

            $message = $e->getMessage();
            if (str_contains($message, 'Vite manifest not found') || str_contains($message, 'Unable to locate file in Vite manifest')) {
                $body = "<!doctype html><html><head><meta charset=\"utf-8\"><title>Frontend assets not built</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;padding:0 24px;color:#111}code{background:#f4f4f5;padding:2px 6px;border-radius:4px}</style></head><body><h1>Frontend assets not built</h1><p>The Vite manifest is missing, so the application can't render its UI.</p><p>On the server, run:</p><pre><code>npm install\nnpm run build</code></pre><p>Then reload this page. If you uploaded a release build, make sure the <code>public/build</code> directory was included.</p></body></html>";

                return response($body, 500)->header('Content-Type', 'text/html');
            }

            return null;
        });
    })->create();
