<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seed the bundled default design system (Substrate) as part of the migration run.
 *
 * The design-system overlay is an un-gated, core step in every build (Substrate is
 * the default look). The data is normally inserted by DesignSystemSeeder, but the
 * web updater (UpgradeController) runs ONLY `migrate --force` — it never invokes
 * seeders. So clients upgrading via /upgrade would otherwise end up with an empty
 * `design_systems` table and unstyled builds. Delivering the required row here
 * guarantees it reaches the web-updater path as well as fresh installs.
 *
 * Idempotent: updates the Substrate row if present, inserts it otherwise, and
 * preserves the original created_at. Query-builder based so it stays correct even
 * if the Eloquent model changes. Only Substrate is seeded — the premium pack remains
 * an admin-uploaded add-on, matching DesignSystemSeeder's production behavior.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        $attributes = [
            'name' => 'Substrate',
            'description' => 'A warm-neutral, premium house style — Geist + Newsreader, tactile elevation, a 10px radius. The high-end default for almost anything.',
            'when_to_use' => 'The default for most projects: SaaS, marketing, dashboards, stores, blogs. Clean, modern, restrained.',
            'zip_path' => 'design-systems/substrate.zip',
            'version' => '1.0.0',
            'author' => 'Webby',
            'is_default' => true,
            'status' => 'active',
            'updated_at' => $now,
        ];

        if (DB::table('design_systems')->where('slug', 'substrate')->exists()) {
            DB::table('design_systems')->where('slug', 'substrate')->update($attributes);
        } else {
            DB::table('design_systems')->insert($attributes + [
                'slug' => 'substrate',
                'created_at' => $now,
            ]);
        }

        // Single-default invariant: Substrate is the only default — demote any other
        // system that is (or was) marked default.
        DB::table('design_systems')
            ->where('slug', '!=', 'substrate')
            ->where('is_default', true)
            ->update(['is_default' => false, 'updated_at' => $now]);
    }

    public function down(): void
    {
        // No-op: this is seed data. The Substrate row may pre-date this migration
        // (e.g. inserted by DesignSystemSeeder on a fresh install), so removing it on
        // rollback would be wrong. Leaving the data in place is the safe choice.
    }
};
