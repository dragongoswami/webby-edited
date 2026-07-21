<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('build_credit_usage', 'estimated_cost')) {
            Schema::table('build_credit_usage', function (Blueprint $table) {
                $table->dropColumn('estimated_cost');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('build_credit_usage', 'estimated_cost')) {
            Schema::table('build_credit_usage', function (Blueprint $table) {
                $table->decimal('estimated_cost', 12, 6)->default(0)->after('total_tokens');
            });
        }
    }
};
