<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Seed the bundled WordPress default block theme template as part of the migration run.
 *
 * The `wordpress-default` template is an is_system, un-deletable base — the FSE
 * starting point every AI-generated WordPress theme is built from. It is normally
 * inserted by TemplateSeeder (which runs on fresh installs), but the web updater
 * (UpgradeController) runs ONLY `migrate --force` — it never invokes seeders. So
 * clients upgrading via /upgrade would get the new `output_target` column and the
 * shipped `templates/wordpress-default.zip` artifact, but no template ROW pointing
 * at it — leaving the WordPress plugin (once purchased) with no base theme to build
 * from. Delivering the required row here guarantees it reaches the web-updater path
 * as well as fresh installs, exactly like 2026_06_05_000001 does for Substrate.
 *
 * Idempotent: updates the row if present, inserts it otherwise, and preserves the
 * original created_at. Query-builder based so it stays correct even if the Eloquent
 * model changes. The row stays dormant until the WordPress plugin is active (the
 * template is only ever shown in WordPress mode).
 */
return new class extends Migration
{
    public function up(): void
    {
        // The output_target column must exist first; this migration is ordered after
        // 2026_06_09_000002, but guard defensively in case of an out-of-order replay.
        if (! Schema::hasColumn('templates', 'output_target')) {
            return;
        }

        $now = now();

        $attributes = [
            'name' => 'Default (WordPress)',
            'description' => 'The default WordPress Full Site Editing (FSE) block theme — theme.json, block templates, header/footer parts, block patterns, and functions.php. The starting point for AI-generated WordPress themes.',
            'category' => 'wordpress',
            'keywords' => json_encode(['wordpress', 'block theme', 'fse', 'gutenberg', 'default']),
            'zip_path' => 'templates/wordpress-default.zip',
            'version' => '1.0.0',
            'is_system' => true,
            'output_target' => 'wordpress_theme',
            'metadata' => json_encode([
                'framework' => 'WordPress FSE',
                'format' => 'block theme',
            ]),
            'updated_at' => $now,
        ];

        if (DB::table('templates')->where('slug', 'wordpress-default')->exists()) {
            DB::table('templates')->where('slug', 'wordpress-default')->update($attributes);
        } else {
            DB::table('templates')->insert($attributes + [
                'slug' => 'wordpress-default',
                'created_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // No-op: this is seed data. The row may pre-date this migration (e.g. inserted
        // by TemplateSeeder on a fresh install), so removing it on rollback would be
        // wrong. Leaving the data in place is the safe choice.
    }
};
