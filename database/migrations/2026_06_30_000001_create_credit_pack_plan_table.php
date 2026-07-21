<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('credit_pack_plan')) {
            Schema::create('credit_pack_plan', function (Blueprint $table) {
                $table->id();
                $table->foreignId('credit_pack_id')->constrained()->cascadeOnDelete();
                $table->foreignId('plan_id')->constrained()->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['credit_pack_id', 'plan_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_pack_plan');
    }
};
