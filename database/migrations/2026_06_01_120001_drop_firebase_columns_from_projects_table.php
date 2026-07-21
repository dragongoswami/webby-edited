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
        Schema::table('projects', function (Blueprint $table) {
            $columns = [];

            if (Schema::hasColumn('projects', 'firebase_config')) {
                $columns[] = 'firebase_config';
            }
            if (Schema::hasColumn('projects', 'uses_system_firebase')) {
                $columns[] = 'uses_system_firebase';
            }
            if (Schema::hasColumn('projects', 'firebase_admin_service_account')) {
                $columns[] = 'firebase_admin_service_account';
            }

            if (! empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->text('firebase_config')->nullable();
            $table->boolean('uses_system_firebase')->default(true);
            $table->text('firebase_admin_service_account')->nullable();
        });
    }
};
