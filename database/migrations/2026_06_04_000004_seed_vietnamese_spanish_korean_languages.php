<?php

use App\Models\Language;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Seed Vietnamese, Spanish, and Korean languages
     * for existing installations that are upgrading.
     */
    public function up(): void
    {
        if (! Schema::hasTable('languages')) {
            return;
        }

        $newLanguages = [
            [
                'code' => 'vi',
                'country_code' => 'VN',
                'name' => 'Vietnamese',
                'native_name' => 'Tiếng Việt',
                'is_rtl' => false,
                'is_active' => true,
                'is_default' => false,
            ],
            [
                'code' => 'es',
                'country_code' => 'ES',
                'name' => 'Spanish',
                'native_name' => 'Español',
                'is_rtl' => false,
                'is_active' => true,
                'is_default' => false,
            ],
            [
                'code' => 'ko',
                'country_code' => 'KR',
                'name' => 'Korean',
                'native_name' => '한국어',
                'is_rtl' => false,
                'is_active' => true,
                'is_default' => false,
            ],
        ];

        foreach ($newLanguages as $lang) {
            if (! Language::where('code', $lang['code'])->exists()) {
                $lang['sort_order'] = (Language::max('sort_order') ?? 0) + 1;
                $lang['created_at'] = now();
                $lang['updated_at'] = now();
                Language::create($lang);
            }
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
