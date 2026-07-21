<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            if (! Schema::hasColumn('plans', 'enable_database')) {
                $column = $table->boolean('enable_database')->default(false);
                if (Schema::hasColumn('plans', 'enable_web_agent')) {
                    $column->after('enable_web_agent');
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            if (Schema::hasColumn('plans', 'enable_database')) {
                $table->dropColumn('enable_database');
            }
        });
    }
};
