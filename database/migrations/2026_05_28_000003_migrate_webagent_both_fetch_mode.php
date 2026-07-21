<?php

use App\Models\Plugin;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up(): void
    {
        $plugin = Plugin::where('slug', 'webagent')->first();
        if (! $plugin) {
            return;
        }
        $config = $plugin->config ?? [];
        if (($config['fetch_mode'] ?? null) !== 'both') {
            return;
        }
        $config['fetch_mode'] = 'http';
        $plugin->config = $config;
        $plugin->save();
        Log::info('webagent: migrated fetch_mode=both -> http on plugin upgrade');
    }

    public function down(): void
    {
        // Intentionally one-way: don't reintroduce removed value.
    }
};
