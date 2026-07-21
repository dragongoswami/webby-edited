<?php

use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Laravel\Sanctum\Http\Middleware\AuthenticateSession;
use Laravel\Sanctum\Sanctum;

return [

    /*
     * Stateful SPA mode is intentionally NOT used (EnsureFrontendRequestsAreStateful
     * is not mounted anywhere). This array is retained for reference only — it has
     * no effect unless that middleware is added to the api group.
     */
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
        Sanctum::currentApplicationUrlWithPort(),
    ))),

    'guard' => ['web'],

    // Global token lifetime cap (minutes). Per-key expiry is set at creation.
    'expiration' => null,

    /*
     * Neutral, white-label-safe key prefix (the brand is operator-configurable,
     * so the prefix must never be brand-derived).
     */
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', 'sk_'),

    'middleware' => [
        'authenticate_session' => AuthenticateSession::class,
        'encrypt_cookies' => EncryptCookies::class,
        'validate_csrf_token' => ValidateCsrfToken::class,
    ],

];
