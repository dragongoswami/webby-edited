<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('system_settings')
            ->where('key', 'like', 'firebase_system_%')
            ->orWhere('key', 'firebase_admin_service_account')
            ->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // irreversible: removed legacy firebase settings
    }
};
