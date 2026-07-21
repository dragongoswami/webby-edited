<?php

namespace App\Jobs;

use App\Services\InternalAiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Regenerates and caches internal AI landing content out of band.
 *
 * Dispatched (after the HTTP response) when a public page hits a cold cache,
 * so visitors are never blocked on synchronous AI provider calls. The 3x-daily
 * cron normally keeps the cache warm; this job only covers the gap after a
 * fresh install or an admin cache clear.
 */
class WarmInternalAiContentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Generation is best-effort; do not retry on failure.
     */
    public int $tries = 1;

    /**
     * Upper bound covering several sequential provider calls.
     */
    public int $timeout = 120;

    public function __construct(public ?string $locale = null) {}

    public function handle(InternalAiService $service): void
    {
        // Warm runs on the after-response path; with a "sync" queue connection it
        // executes inside Application::terminate() after headers are flushed. Any
        // exception that escapes here is caught by Laravel's exception handler,
        // which tries to render an HTTP response and triggers a fatal
        // "Cannot modify header information - headers already sent".
        try {
            $service->refreshAllContent($this->locale);
        } catch (Throwable $e) {
            Log::warning('Internal AI warm job failed', [
                'locale' => $this->locale,
                'exception' => $e::class,
                'message' => $e->getMessage(),
            ]);
        }
    }
}
