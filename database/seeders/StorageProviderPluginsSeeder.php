<?php

namespace Database\Seeders;

use App\Models\Plugin;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;

class StorageProviderPluginsSeeder extends Seeder
{
    /**
     * Bundled storage-provider plugins, keyed by their on-disk directory under
     * app/Plugins/StorageProviders/. Each is installed (inactive) so it appears as
     * a ready-to-configure card in Admin > Plugins.
     */
    private const PLUGINS = [
        'AwsS3' => [
            'name' => 'Amazon S3',
            'slug' => 's3-aws',
            'class' => 'App\Plugins\StorageProviders\AwsS3Plugin',
        ],
        'DigitalOcean' => [
            'name' => 'DigitalOcean Spaces',
            'slug' => 's3-digitalocean',
            'class' => 'App\Plugins\StorageProviders\DigitalOceanSpacesPlugin',
        ],
        'Backblaze' => [
            'name' => 'Backblaze B2',
            'slug' => 's3-backblaze',
            'class' => 'App\Plugins\StorageProviders\BackblazeB2Plugin',
        ],
    ];

    /**
     * Run the database seeds.
     *
     * Storage providers are only auto-installed in local/dev environments (which
     * includes demo mode). In production, operators install them via Admin > Plugins.
     * They are seeded inactive: activation requires real bucket credentials and only
     * one provider may be active at a time.
     */
    public function run(): void
    {
        if (! app()->environment('local')) {
            return;
        }

        foreach (self::PLUGINS as $dir => $plugin) {
            Plugin::updateOrCreate(
                ['slug' => $plugin['slug']],
                [
                    'name' => $plugin['name'],
                    'type' => 'storage_provider',
                    'class' => $plugin['class'],
                    'version' => '1.0.0',
                    'status' => 'inactive',
                    'config' => null,
                    'metadata' => $this->getPluginMetadata($dir),
                    'migrations' => null,
                    'installed_at' => now(),
                ]
            );

            $this->command?->info("Installed storage provider: {$plugin['name']}");
        }
    }

    /**
     * Get plugin metadata from the plugin.json file.
     */
    private function getPluginMetadata(string $pluginDir): ?array
    {
        $path = app_path("Plugins/StorageProviders/{$pluginDir}/plugin.json");

        if (! File::exists($path)) {
            return null;
        }

        return json_decode(File::get($path), true);
    }
}
