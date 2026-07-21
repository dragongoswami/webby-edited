<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shopify_connections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('label');
            $table->string('shop_domain'); // <store>.myshopify.com
            $table->text('access_token')->nullable(); // encrypted offline token
            $table->string('scope')->nullable();
            $table->string('status')->default('active'); // active | revoked
            $table->dateTime('last_used_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'shop_domain']);
            $table->index(['user_id', 'status']);
            $table->index('shop_domain');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopify_connections');
    }
};
