<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\Plugin;
use Illuminate\Database\Seeder;

/**
 * Registers the WordPress builder-capability plugin as active and enables the
 * WordPress output target on the Pro plan. Seeded for local development and the
 * demo (like the Web Agent plugin) so the WordPress block-theme flow works out
 * of the box. The plugin source lives at app/Plugins/BuilderCapabilities/WordPress/.
 *
 * On a normal (non-local) install this seeder is NOT run, so WordPress stays a
 * paid add-on the operator activates in Admin → Plugins.
 */
class WordPressPluginSeeder extends Seeder
{
    public function run(): void
    {
        $manifestPath = app_path('Plugins/BuilderCapabilities/WordPress/plugin.json');

        if (! file_exists($manifestPath)) {
            $this->command?->warn('WordPress plugin manifest not found - skipping');

            return;
        }

        $manifest = json_decode(file_get_contents($manifestPath), true) ?: [];

        Plugin::updateOrCreate(
            ['slug' => 'wordpress'],
            [
                'name' => $manifest['name'] ?? 'WordPress',
                'type' => $manifest['type'] ?? 'builder_capability',
                'class' => $manifest['namespace'] ?? 'App\\Plugins\\BuilderCapabilities\\WordPressPlugin',
                'version' => $manifest['version'] ?? '1.0.0',
                'status' => 'active',
                'metadata' => $manifest,
                'installed_at' => now(),
            ]
        );

        $this->command?->info('Registered WordPress plugin as active');

        $proPlan = Plan::where('slug', 'pro')->first();
        if ($proPlan) {
            $proPlan->forceFill(['enable_wordpress' => true])->save();
            $this->command?->info('Enabled WordPress theme generation on the Pro plan');
        }
    }
}
