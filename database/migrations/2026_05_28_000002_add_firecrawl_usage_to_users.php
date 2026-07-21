<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'firecrawl_pages_used')) {
                $table->unsignedInteger('firecrawl_pages_used')
                    ->default(0)
                    ->after('build_credits');
            }
            if (! Schema::hasColumn('users', 'firecrawl_pages_reset_at')) {
                $table->timestamp('firecrawl_pages_reset_at')
                    ->nullable()
                    ->after('firecrawl_pages_used');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['firecrawl_pages_used', 'firecrawl_pages_reset_at'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
