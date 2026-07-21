<?php

namespace App\Services;

use App\Models\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class BuilderUpdateService
{
    public function appVersion(): string
    {
        return app(UpdateService::class)->currentVersion();
    }

    private function comparable(?string $v): bool
    {
        return $v !== null && preg_match('/^\d+(\.\d+)*$/', $v) === 1;
    }

    public function builderVersion(Builder $b): ?string
    {
        try {
            $resp = Http::timeout(3)->get($b->full_url.'/');
        } catch (\Throwable) {
            return null;
        }

        return $resp->successful() ? ($resp->json('version')) : null;
    }

    /**
     * @return array<int, array{id:int, name:string, url:string, version:?string, drift:bool}>
     */
    public function status(): array
    {
        if (! app(UpdateService::class)->enabled()) {
            return [];
        }

        return Cache::remember('builder_update_status', 30, function () {
            $app = $this->appVersion();

            return Builder::active()->get()->map(function (Builder $b) use ($app) {
                $v = $this->builderVersion($b);

                return [
                    'id' => $b->id, 'name' => $b->name, 'url' => $b->full_url,
                    'version' => $v, 'drift' => $this->comparable($v) && $this->comparable($app) && version_compare($v, $app, '<'),
                ];
            })->all();
        });
    }

    /**
     * Trigger self-update on each lagging active builder.
     *
     * @return array<int, array{id:int, result:string}>
     */
    public function sync(?int $builderId = null): array
    {
        if (! app(UpdateService::class)->enabled()) {
            return [];
        }

        $app = $this->appVersion();
        $query = Builder::active();
        if ($builderId !== null) {
            $query->where('id', $builderId);
        }

        $out = [];
        foreach ($query->get() as $b) {
            $v = $this->builderVersion($b);
            if (! $this->comparable($v) || ! $this->comparable($app)) {
                $out[] = ['id' => $b->id, 'result' => 'unreachable'];

                continue;
            }
            $cmp = version_compare($v, $app);
            if ($cmp === 0) {
                $out[] = ['id' => $b->id, 'result' => 'up_to_date'];

                continue;
            }
            if ($cmp > 0) {
                $out[] = ['id' => $b->id, 'result' => 'ahead'];

                continue;
            }
            // $cmp < 0 → builder is behind → trigger self-update
            try {
                $resp = Http::withHeaders(['X-Server-Key' => $b->server_key])
                    ->timeout(10)
                    ->post($b->full_url.'/api/self-update', [
                        'version' => $app,
                        'download_url' => config('app.url').'/api/builder/binary',
                        'prompts_url' => config('app.url').'/api/builder/prompts',
                    ]);
            } catch (\Throwable) {
                $out[] = ['id' => $b->id, 'result' => 'unreachable'];

                continue;
            }

            $out[] = ['id' => $b->id, 'result' => $resp->status() === 409
                ? 'busy'
                : ($resp->successful() ? 'triggered' : 'failed')];
        }

        Cache::forget('builder_update_status');

        return $out;
    }
}
