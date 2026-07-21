<?php

return [
    'code' => env('APP_DEMO_CODE'),

    'ai_key' => env('APP_DEMO_AI_KEY'),

    'pusher' => [
        'app_id' => env('APP_DEMO_PUSHER_APPID', ''),
        'key' => env('APP_DEMO_PUSHER_KEY', ''),
        'secret' => env('APP_DEMO_PUSHER_SECRET', ''),
        'cluster' => env('APP_DEMO_PUSHER_CLUSTER', 'mt1'),
    ],

    // Demo GitHub App credentials. When the required values (app_id,
    // private_key, client_id, client_secret) are present, DemoSeeder
    // activates the GitHub plugin and enables it on the Pro plan.
    // private_key is the App's PEM, base64-encoded to survive .env's
    // single-line values (decoded in DemoSeeder).
    'github' => [
        'app_id' => env('APP_DEMO_GITHUB_APP_ID', ''),
        'app_slug' => env('APP_DEMO_GITHUB_APP_SLUG', ''),
        'private_key' => env('APP_DEMO_GITHUB_PRIVATE_KEY', ''),
        'client_id' => env('APP_DEMO_GITHUB_CLIENT_ID', ''),
        'client_secret' => env('APP_DEMO_GITHUB_CLIENT_SECRET', ''),
        'webhook_secret' => env('APP_DEMO_GITHUB_WEBHOOK_SECRET', ''),
    ],

    // Demo Shopify OAuth app credentials. When the required values
    // (api_key, api_secret, webhook_secret) are all present, DemoSeeder
    // activates the Shopify plugin and enables it on the Pro plan.
    'shopify' => [
        'api_key' => env('APP_DEMO_SHOPIFY_API_KEY', ''),
        'api_secret' => env('APP_DEMO_SHOPIFY_API_SECRET', ''),
        'webhook_secret' => env('APP_DEMO_SHOPIFY_WEBHOOK_SECRET', ''),
    ],

    'smtp' => [
        'host' => env('APP_DEMO_SMTP_HOST', 'smtp.example.com'),
        'port' => env('APP_DEMO_SMTP_PORT', 587),
        'username' => env('APP_DEMO_SMTP_USERNAME', 'demo@example.com'),
        'password' => env('APP_DEMO_SMTP_PASSWORD', ''),
        'encryption' => env('APP_DEMO_SMTP_ENCRYPTION', 'tls'),
        'from_address' => env('APP_DEMO_SMTP_FROM_ADDRESS', 'noreply@example.com'),
        'from_name' => env('APP_DEMO_SMTP_FROM_NAME'),
    ],
];
