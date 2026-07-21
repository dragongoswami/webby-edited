<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            if (! Schema::hasColumn('plans', 'max_firecrawl_pages_per_month')) {
                // NULL = unlimited, 0 = blocked, N = N pages per calendar month
                $table->unsignedInteger('max_firecrawl_pages_per_month')
                    ->nullable()
                    ->after('enable_web_agent');
            }
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            if (Schema::hasColumn('plans', 'max_firecrawl_pages_per_month')) {
                $table->dropColumn('max_firecrawl_pages_per_month');
            }
        });
    }
};
