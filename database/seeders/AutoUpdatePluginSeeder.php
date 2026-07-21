<?php

namespace Database\Seeders;

use App\Models\Plugin;
use Illuminate\Database\Seeder;

/**
 * Registers the Auto Update system plugin (slug: auto-update) for local
 * development and the demo so it appears in Admin → Plugins ready to enable.
 * It is installed but left INACTIVE — the operator activates it themselves
 * (like the premium payment-gateway / storage-provider plugins). The plugin
 * source lives at app/Plugins/System/AutoUpdate/.
 *
 * On a normal (non-local) install this seeder is NOT run, so Auto Update stays a
 * paid add-on the operator installs in Admin → Plugins.
 */
class AutoUpdatePluginSeeder extends Seeder
{
    public function run(): void
    {
        $manifestPath = app_path('Plugins/System/AutoUpdate/plugin.json');

        if (! file_exists($manifestPath)) {
            $this->command?->warn('Auto Update plugin manifest not found - skipping');

            return;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true) ?: [];

        Plugin::updateOrCreate(
            ['slug' => 'auto-update'],
            [
                'name' => $manifest['name'] ?? 'Auto Update',
                'type' => $manifest['type'] ?? 'system',
                'class' => $manifest['namespace'] ?? 'App\\Plugins\\System\\AutoUpdatePlugin',
                'version' => $manifest['version'] ?? '1.0.0',
                'status' => 'inactive',
                'metadata' => $manifest,
                'installed_at' => now(),
            ]
        );

        $this->command?->info('Registered Auto Update plugin (inactive)');
    }
}
