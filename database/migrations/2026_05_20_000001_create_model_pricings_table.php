<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('model_pricings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ai_provider_id')->constrained()->cascadeOnDelete();
            $table->string('model_name');
            $table->string('display_name')->nullable();
            $table->decimal('input_per_1m', 12, 6)->default(0);
            $table->decimal('output_per_1m', 12, 6)->default(0);
            $table->decimal('cache_read_per_1m', 12, 6)->nullable();
            $table->decimal('cache_write_per_1m', 12, 6)->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->boolean('is_free_tier')->default(false);
            $table->integer('sort_order')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['ai_provider_id', 'model_name']);
            $table->index(['ai_provider_id', 'is_enabled', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('model_pricings');
    }
};
