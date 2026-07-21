<?php

use App\Models\LandingSection;
use Database\Seeders\LandingPageSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Backfill new landing-page content for existing installations on upgrade.
     *
     * This release adds 7 new feature cards (WordPress/Shopify/GitHub themes,
     * Supabase database, design systems, personal API, voice input) and three
     * locales (es/ko/vi). LandingPageSeeder is now idempotent and additive, so
     * running it here inserts only what an install is missing without
     * duplicating rows or overwriting an operator's Landing Builder edits.
     */
    public function up(): void
    {
        if (! Schema::hasTable('landing_sections')) {
            return;
        }

        // Skip entirely on a never-seeded install — the dedicated seed-data
        // migration / DatabaseSeeder owns the initial population; this step is
        // only for installs that already have landing content from a prior
        // version and need the new cards/locales backfilled.
        if (LandingSection::count() === 0) {
            return;
        }

        (new LandingPageSeeder)->run();
    }

    /**
     * Reverse the migration.
     */
    public function down(): void
    {
        // No-op: landing content may have been customized by the operator, so
        // a rollback must never delete it.
    }
};
