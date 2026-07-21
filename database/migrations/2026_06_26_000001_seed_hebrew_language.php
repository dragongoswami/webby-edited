<?php

use App\Models\Language;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Seed the Hebrew language for existing installations that are upgrading.
     */
    public function up(): void
    {
        if (! Schema::hasTable('languages')) {
            return;
        }

        if (! Language::where('code', 'he')->exists()) {
            Language::create([
                'code' => 'he',
                'country_code' => 'IL',
                'name' => 'Hebrew',
                'native_name' => 'עברית',
                'is_rtl' => true,
                'is_active' => true,
                'is_default' => false,
                'sort_order' => (Language::max('sort_order') ?? 0) + 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Don't remove languages on rollback as admins may have customized them
    }
};
