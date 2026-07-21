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
            if (! Schema::hasColumn('users', 'supabase_config')) {
                // Encrypted JSON: connection details for a self-hosted per-user Supabase stack.
                $table->text('supabase_config')->nullable();
            }
            if (! Schema::hasColumn('users', 'supabase_provisioned_at')) {
                $table->timestamp('supabase_provisioned_at')->nullable();
            }
            if (! Schema::hasColumn('users', 'supabase_status')) {
                // active|suspended|reclaimed; null = none provisioned.
                $table->string('supabase_status')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['supabase_config', 'supabase_provisioned_at', 'supabase_status']);
        });
    }
};
