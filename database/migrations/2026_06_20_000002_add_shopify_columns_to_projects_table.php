<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            // Anchor after github_connection_id if it exists, otherwise after supabase_connection_id
            $after = Schema::hasColumn('projects', 'github_connection_id')
                ? 'github_connection_id'
                : 'supabase_connection_id';

            $table->foreignId('shopify_connection_id')->nullable()->after($after)
                ->constrained('shopify_connections')->nullOnDelete();
            $table->string('shopify_theme_id')->nullable()->after('shopify_connection_id'); // gid://shopify/OnlineStoreTheme/<n>
            $table->string('shopify_store_domain')->nullable()->after('shopify_theme_id');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shopify_connection_id');
            $table->dropColumn(['shopify_theme_id', 'shopify_store_domain']);
        });
    }
};
