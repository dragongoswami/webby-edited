<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('projects')
            ->whereNotNull('deleted_at')
            ->where(function ($q) {
                $q->whereNotNull('subdomain')->orWhereNotNull('custom_domain');
            })
            ->update([
                'subdomain' => null,
                'custom_domain' => null,
                'custom_domain_verified' => false,
                'custom_domain_ssl_status' => null,
                'custom_domain_verified_at' => null,
                'published_at' => null,
            ]);
    }

    public function down(): void
    {
        // Data migration — cannot be reversed
    }
};
