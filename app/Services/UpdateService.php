<?php

namespace App\Services;

use App\Models\Plugin;
use Illuminate\Support\Facades\Http;

class UpdateService
{
    public const HOST = 'https://update.titansys.dev';

    public function enabled(): bool
    {
        return app(PluginManager::class)->isActive('auto-update');
    }

    public function pluginConfig(): array
    {
        $p = Plugin::where('slug', 'auto-update')->first();

        return $p?->config ?? [];
    }

    public function purchaseCode(): ?string
    {
        return $this->pluginConfig()['purchase_code'] ?? null;
    }

    public function autoApply(): bool
    {
        return (bool) ($this->pluginConfig()['auto_apply'] ?? false);
    }

    public function currentVersion(): string
    {
        $f = base_path('.version');

        return is_file($f) ? trim((string) file_get_contents($f)) : 'unknown';
    }

    public function check(): array
    {
        try {
            $resp = Http::acceptJson()->timeout(10)->get(self::HOST.'/api/updates/check', [
                'product_id' => (string) config('app.product_id'),
                'code' => $this->purchaseCode(),
                'current' => $this->currentVersion(),
            ]);
        } catch (\Throwable $e) {
            return ['update' => false, 'error' => 'unreachable'];
        }

        if (! $resp->successful()) {
            return ['update' => false, 'error' => $resp->status()];
        }

        return $resp->json() ?? ['update' => false];
    }
}
