<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->foreignId('github_connection_id')->nullable()->constrained('github_connections')->nullOnDelete();
            $table->string('github_repo_owner')->nullable();
            $table->string('github_repo_name')->nullable();
            $table->unsignedBigInteger('github_repo_id')->nullable();
            $table->string('github_default_branch')->default('main');
            $table->boolean('github_auto_push')->default(true);
            $table->boolean('github_repo_private')->default(true);
            $table->dateTime('github_last_pushed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('github_connection_id');
            $table->dropColumn([
                'github_repo_owner', 'github_repo_name', 'github_repo_id',
                'github_default_branch', 'github_auto_push', 'github_repo_private', 'github_last_pushed_at',
            ]);
        });
    }
};
