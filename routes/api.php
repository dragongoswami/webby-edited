<?php

use App\Http\Controllers\Api\BuilderBinaryController;
use App\Http\Controllers\Api\BuilderGithubController;
use App\Http\Controllers\Api\BuilderPromptsController;
use App\Http\Controllers\Api\BuilderSupabaseController;
use App\Http\Controllers\Api\GithubWebhookController;
use App\Http\Controllers\Api\ImageLibraryApiController;
use App\Http\Controllers\Api\ShopifyWebhookController;
use App\Http\Controllers\Api\V1\CreditsController;
use App\Http\Controllers\Api\V1\InvoicesController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\NotificationsController;
use App\Http\Controllers\Api\V1\ProjectFilesController;
use App\Http\Controllers\Api\V1\ProjectsController;
use App\Http\Controllers\Api\V1\SubscriptionController;
use App\Http\Controllers\BuilderWebhookController;
use App\Http\Controllers\ProjectFileController;
use App\Http\Controllers\TemplateApiController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group.
|
*/

// Builder webhook - receives events from Go builder service
// Authenticated via X-Server-Key header (validated against builders table)
Route::post('/builder/webhook', [BuilderWebhookController::class, 'handle'])
    ->middleware('verify.server.key')
    ->name('builder.webhook');

// Template API - for builder Go service
// These endpoints require X-Server-Key header authentication
Route::middleware('verify.server.key')->group(function () {
    Route::post('/webhook/firecrawl-usage', [BuilderWebhookController::class, 'firecrawlUsage'])
        ->name('webhook.firecrawl-usage');
    Route::get('/templates', [TemplateApiController::class, 'index'])->name('api.templates.index');
    Route::get('/templates/{id}', [TemplateApiController::class, 'show'])->name('api.templates.show');
    Route::get('/templates/{id}/download', [TemplateApiController::class, 'download'])->name('api.templates.download');

    // Stock image library for builder AI agent
    Route::get('/image-library', [ImageLibraryApiController::class, 'index'])->name('api.image-library');

    // Supabase DDL: agent-driven table creation (platform-authored SQL + RLS)
    Route::post('/supabase/define-table', [BuilderSupabaseController::class, 'defineTable'])
        ->name('api.supabase.define-table');

    // GitHub: builder requests a fresh per-repo installation token before each git op
    Route::post('/github/token', [BuilderGithubController::class, 'token'])
        ->name('api.github.token');

    // GitHub: builder reports the new HEAD sha after a successful push
    Route::post('/github/pushed', [BuilderGithubController::class, 'pushed'])
        ->name('api.github.pushed');

    // Builder auto-update: serves the arch-matched builder binary (staged from release.zip)
    Route::get('/builder/binary', [BuilderBinaryController::class, 'serve'])
        ->name('api.builder.binary');

    // Builder auto-update: serves a zip of the staged prompts/ (mirrored on self-update)
    Route::get('/builder/prompts', [BuilderPromptsController::class, 'serve'])
        ->name('api.builder.prompts');
});

// GitHub lifecycle webhook - App uninstalled / repos removed.
// NOT X-Server-Key authed: verified via its own HMAC X-Hub-Signature-256
// (using the webhook_secret from the github plugin config). Public route.
Route::post('/github/webhook', [GithubWebhookController::class, 'handle'])
    ->name('api.github.webhook');

// Shopify app lifecycle webhook - app/uninstalled revokes the connection.
// NOT X-Server-Key authed: verified via Shopify HMAC (base64 SHA-256).
// Public route.
Route::post('/shopify/webhook', [ShopifyWebhookController::class, 'handle'])
    ->middleware('throttle:300,1')
    ->name('api.shopify.webhook');

// Public file serving - no auth required
// Filenames are UUIDs so they are unguessable, safe to serve publicly.
// Used by AI-generated code to embed project files (images, etc.) in <img> tags.
Route::get('/files/{projectId}/{filename}', [ProjectFileController::class, 'publicServe'])
    ->middleware('throttle:120,1')
    ->name('api.files.public');

// Generated app file API - authenticated via project API token
// Used by generated apps to upload/retrieve files
Route::middleware('verify.project.token')->group(function () {
    Route::post('/app/{projectId}/files', [ProjectFileController::class, 'appUpload'])
        ->middleware('throttle:30,1')
        ->name('api.app.files.upload');
    Route::get('/app/{projectId}/files/{path}', [ProjectFileController::class, 'appServe'])
        ->where('path', '.*')
        ->middleware('throttle:120,1')
        ->name('api.app.files.serve');
    Route::get('/app/{projectId}/files', [ProjectFileController::class, 'appIndex'])
        ->middleware('throttle:120,1')
        ->name('api.app.files.index');
    Route::delete('/app/{projectId}/files/{fileId}', [ProjectFileController::class, 'appDestroy'])
        ->middleware('throttle:60,1')
        ->name('api.app.files.destroy');
});

// User API v1 — read-only account data, authenticated by personal API keys
// (Sanctum). ForceJsonResponse is prepended to the api group globally
// (bootstrap/app.php), so auth failures return 401 JSON rather than redirects.
Route::prefix('v1')
    ->middleware(['auth:sanctum', 'abilities:read', 'api.enabled', 'throttle:api-v1'])
    ->group(function () {
        Route::get('/me', MeController::class)->name('api.v1.me');
        Route::get('/credits', CreditsController::class)->name('api.v1.credits');
        Route::get('/subscription', SubscriptionController::class)->name('api.v1.subscription');
        Route::get('/projects', [ProjectsController::class, 'index'])->name('api.v1.projects.index');
        Route::get('/projects/{projectId}', [ProjectsController::class, 'show'])->name('api.v1.projects.show');
        Route::get('/projects/{projectId}/files', [ProjectFilesController::class, 'index'])->name('api.v1.projects.files.index');
        Route::get('/projects/{projectId}/files/{fileId}', [ProjectFilesController::class, 'show'])->name('api.v1.projects.files.show');
        Route::get('/notifications', NotificationsController::class)->name('api.v1.notifications');
        Route::get('/invoices', InvoicesController::class)->name('api.v1.invoices');
    });
