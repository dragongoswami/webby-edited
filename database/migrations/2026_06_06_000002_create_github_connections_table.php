<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('github_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('github_login');
            $table->string('account_type')->default('User'); // User | Organization
            $table->unsignedBigInteger('installation_id');
            $table->text('user_access_token')->nullable();
            $table->dateTime('user_token_expires_at')->nullable();
            $table->text('user_refresh_token')->nullable();
            $table->string('scopes')->nullable();
            $table->string('status')->default('active'); // active | revoked
            $table->dateTime('last_used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
            $table->index('installation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('github_connections');
    }
};
