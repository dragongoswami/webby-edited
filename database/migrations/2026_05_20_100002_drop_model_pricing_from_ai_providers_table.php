<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('ai_providers', 'model_pricing')) {
            Schema::table('ai_providers', function (Blueprint $table) {
                $table->dropColumn('model_pricing');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('ai_providers', 'model_pricing')) {
            Schema::table('ai_providers', function (Blueprint $table) {
                $table->json('model_pricing')->nullable();
            });
        }
    }
};
