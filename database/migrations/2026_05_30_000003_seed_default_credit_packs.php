<?php

use Database\Seeders\CreditPackSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Seed the default credit packs for EXISTING installations on upgrade.
     *
     * The upgrade flow runs `migrate` (not seeders), so this migration ensures
     * already-installed sites receive the default packs. It only runs when the
     * site already has users — a fresh install has no users at migration time
     * (the admin is created after seeding), so fresh installs are seeded by
     * CreditPackSeeder in the normal seeder list, after the system currency is
     * configured. This guard also keeps test databases (RefreshDatabase) clean.
     * Idempotent via CreditPackSeeder's firstOrCreate-by-slug.
     */
    public function up(): void
    {
        if (DB::table('users')->exists()) {
            (new CreditPackSeeder)->run();
        }
    }

    public function down(): void
    {
        DB::table('credit_packs')
            ->whereIn('slug', ['starter-pack', 'booster-pack', 'mega-pack'])
            ->delete();
    }
};
