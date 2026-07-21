<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seed the bundled Shopify Skeleton starter theme template as part of the migration run.
 *
 * The `shopify-skeleton` template is an is_system, un-deletable base — the OS 2.0
 * starting point every AI-generated Shopify theme is built from. It is normally
 * inserted by TemplateSeeder (which runs on fresh installs), but the web updater
 * (UpgradeController) runs ONLY `migrate --force` — it never invokes seeders. So
 * clients upgrading via /upgrade would get the new output_target value and the
 * shipped `templates/shopify-default.zip` artifact, but no template ROW pointing
 * at it — leaving the Shopify plugin (once purchased) with no base theme to build
 * from. Delivering the required row here guarantees it reaches the web-updater path
 * as well as fresh installs, mirroring 2026_06_10_000002_seed_wordpress_default_template.php.
 *
 * Idempotent: skips insert if the row already exists (inserted by TemplateSeeder
 * on a fresh install). Query-builder based so it stays correct even if the Eloquent
 * model changes. The row stays dormant until the Shopify plugin is active.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $exists = DB::table('templates')->where('slug', 'shopify-skeleton')->exists();
        if ($exists) {
            return;
        }

        DB::table('templates')->insert([
            'slug' => 'shopify-skeleton',
            'name' => 'Shopify Skeleton',
            'description' => "Shopify Online Store 2.0 starter theme based on Shopify's official Skeleton reference theme. The starting point for AI-generated Shopify themes.",
            'category' => 'shopify',
            'keywords' => json_encode(['shopify', 'theme', 'online store 2.0', 'liquid', 'skeleton', 'default']),
            'zip_path' => 'templates/shopify-default.zip',
            'version' => '1.0.0',
            'is_system' => true,
            'output_target' => 'shopify_theme',
            'metadata' => json_encode(['framework' => 'Shopify OS 2.0', 'format' => 'liquid theme']),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        DB::table('templates')->where('slug', 'shopify-skeleton')->delete();
    }
};
