<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('model_pricings');
    }

    public function down(): void
    {
        // The Model Pricing feature has been removed; the table is not recreated.
    }
};
