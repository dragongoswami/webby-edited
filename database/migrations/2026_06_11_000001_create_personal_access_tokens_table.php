<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('personal_access_tokens')) {
            // Table may pre-exist if an operator published Sanctum's vendor
            // migration manually — ensure our display column is present.
            if (! Schema::hasColumn('personal_access_tokens', 'last_four')) {
                Schema::table('personal_access_tokens', function (Blueprint $table) {
                    $table->string('last_four', 4)->nullable()->after('abilities');
                });
            }

            return;
        }

        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->morphs('tokenable');
            $table->text('name');
            $table->string('token', 64)->unique();
            $table->text('abilities')->nullable();
            // Last 4 chars of the plaintext key, stored for masked display only.
            $table->string('last_four', 4)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('personal_access_tokens')) {
            return;
        }

        // up() may have only added last_four to a pre-existing table; never
        // destroy token data on rollback — drop just our column.
        if (Schema::hasColumn('personal_access_tokens', 'last_four')) {
            Schema::table('personal_access_tokens', function (Blueprint $table) {
                $table->dropColumn('last_four');
            });
        }
    }
};
