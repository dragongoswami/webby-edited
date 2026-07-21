<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (! Schema::hasColumn('projects', 'design_system_id')) {
                $table->foreignId('design_system_id')->nullable()->after('template_id')->constrained()->nullOnDelete();
            }
            if (! Schema::hasColumn('projects', 'design_accent')) {
                $table->string('design_accent')->nullable()->after('design_system_id');
            }
            if (Schema::hasColumn('projects', 'theme_preset')) {
                $table->dropColumn('theme_preset');
            }
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (! Schema::hasColumn('projects', 'theme_preset')) {
                $table->string('theme_preset', 50)->nullable();
            }
            if (Schema::hasColumn('projects', 'design_system_id')) {
                $table->dropConstrainedForeignId('design_system_id');
            }
            if (Schema::hasColumn('projects', 'design_accent')) {
                $table->dropColumn('design_accent');
            }
        });
    }
};
