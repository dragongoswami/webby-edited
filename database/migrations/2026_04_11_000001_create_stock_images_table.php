<?php

use Database\Seeders\StockImageSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_images', function (Blueprint $table) {
            $table->id();
            $table->string('filename')->unique();
            $table->string('type')->index();       // "background" or "gallery"
            $table->string('subject');
            $table->string('category')->index();
            $table->json('categories');
            $table->string('mood')->nullable();     // backgrounds only
            $table->string('tone');
            $table->string('contrast');
            $table->timestamps();
        });

        // Seed existing stock images for both fresh installs and upgrades
        $seeder = new StockImageSeeder;
        $seeder->run();
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_images');
    }
};
