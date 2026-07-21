<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('enable_support_tickets')->default(false)->after('allowed_file_types');
            $table->unsignedInteger('max_open_tickets_per_user')->nullable()->after('enable_support_tickets');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['enable_support_tickets', 'max_open_tickets_per_user']);
        });
    }
};
