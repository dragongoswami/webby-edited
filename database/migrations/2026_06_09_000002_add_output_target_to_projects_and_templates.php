<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (! Schema::hasColumn('projects', 'output_target')) {
                $table->string('output_target')->default('website')->after('template_id');
            }
        });

        Schema::table('templates', function (Blueprint $table) {
            if (! Schema::hasColumn('templates', 'output_target')) {
                $table->string('output_target')->default('website')->after('zip_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (Schema::hasColumn('projects', 'output_target')) {
                $table->dropColumn('output_target');
            }
        });
        Schema::table('templates', function (Blueprint $table) {
            if (Schema::hasColumn('templates', 'output_target')) {
                $table->dropColumn('output_target');
            }
        });
    }
};
