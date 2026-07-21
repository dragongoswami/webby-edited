<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'supabase_config',
                'supabase_provisioned_at',
                'supabase_status',
                'supabase_suspended_at',
                'supabase_reclaim_warned_at',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('supabase_config')->nullable();
            $table->timestamp('supabase_provisioned_at')->nullable();
            $table->string('supabase_status')->nullable();
            $table->timestamp('supabase_suspended_at')->nullable();
            $table->timestamp('supabase_reclaim_warned_at')->nullable();
        });
    }
};
