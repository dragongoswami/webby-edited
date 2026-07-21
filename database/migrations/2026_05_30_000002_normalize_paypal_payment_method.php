<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('transactions')->where('payment_method', 'paypal')->update(['payment_method' => 'PayPal']);
        DB::table('subscriptions')->where('payment_method', 'paypal')->update(['payment_method' => 'PayPal']);
    }

    public function down(): void
    {
        DB::table('transactions')->where('payment_method', 'PayPal')->update(['payment_method' => 'paypal']);
        DB::table('subscriptions')->where('payment_method', 'PayPal')->update(['payment_method' => 'paypal']);
    }
};
