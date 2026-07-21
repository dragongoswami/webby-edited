<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_ai_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('user_ai_settings', 'ollama_api_key')) {
                $table->text('ollama_api_key')->nullable()->after('zhipu_api_key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('user_ai_settings', function (Blueprint $table) {
            if (Schema::hasColumn('user_ai_settings', 'ollama_api_key')) {
                $table->dropColumn('ollama_api_key');
            }
        });
    }
};
