<?php

use App\Models\AiProvider;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * xAI retired `grok-4-1-fast-reasoning` and `grok-4-1-fast-non-reasoning` on
     * 2026-05-15. Deprecated requests now redirect to `grok-4.3` at standard
     * Grok 4.3 pricing — a silent price hike from $0.20/$0.50 to $1.25/$2.50 per
     * MTok. Migrate stored configs to `grok-4.20-0309-non-reasoning` so admins
     * keep predictable cost.
     */
    public function up(): void
    {
        $retired = [
            'grok-4-1-fast-reasoning',
            'grok-4-1-fast-non-reasoning',
        ];
        $replacement = 'grok-4.20-0309-non-reasoning';

        DB::transaction(function () use ($retired, $replacement) {
            AiProvider::query()
                ->where('type', AiProvider::TYPE_GROK)
                ->get()
                ->each(function (AiProvider $provider) use ($retired, $replacement) {
                    $changed = false;

                    $config = $provider->config ?? [];
                    if (isset($config['default_model']) && in_array($config['default_model'], $retired, true)) {
                        $config['default_model'] = $replacement;
                        $provider->config = $config;
                        $changed = true;
                    }

                    $models = $provider->available_models ?? [];
                    if (is_array($models) && array_intersect($models, $retired)) {
                        $filtered = array_values(array_diff($models, $retired));
                        if (! in_array($replacement, $filtered, true)) {
                            array_unshift($filtered, $replacement);
                        }
                        $provider->available_models = $filtered;
                        $changed = true;
                    }

                    if ($changed) {
                        $provider->save();
                    }
                });
        });
    }

    public function down(): void
    {
        // No rollback: the retired models no longer accept requests, so
        // restoring them would re-break installations.
    }
};
