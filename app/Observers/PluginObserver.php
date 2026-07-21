<?php

namespace App\Observers;

use App\Models\Plugin;
use App\Services\LandingPageService;

class PluginObserver
{
    /**
     * When a plugin's active status changes, the public landing page may need
     * to show/hide plugin-gated feature cards, so its cached config is stale.
     */
    public function updated(Plugin $plugin): void
    {
        if ($plugin->wasChanged('status')) {
            app(LandingPageService::class)->clearCache();
        }
    }

    public function deleted(Plugin $plugin): void
    {
        app(LandingPageService::class)->clearCache();
    }
}
