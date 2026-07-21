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
            $columns = [];

            if (Schema::hasColumn('plans', 'enable_firebase')) {
                $columns[] = 'enable_firebase';
            }
            if (Schema::hasColumn('plans', 'allow_user_firebase_config')) {
                $columns[] = 'allow_user_firebase_config';
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
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('enable_firebase')->default(false);
            $table->boolean('allow_user_firebase_config')->default(false);
        });
    }
};
