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
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'supabase_suspended_at')) {
                $table->timestamp('supabase_suspended_at')->nullable();
            }

            if (! Schema::hasColumn('users', 'supabase_reclaim_warned_at')) {
                $table->timestamp('supabase_reclaim_warned_at')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'supabase_suspended_at')) {
                $table->dropColumn('supabase_suspended_at');
            }

            if (Schema::hasColumn('users', 'supabase_reclaim_warned_at')) {
                $table->dropColumn('supabase_reclaim_warned_at');
            }
        });
    }
};
