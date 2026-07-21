<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\InvoiceResource;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class InvoicesController extends Controller
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        // Floor of 1: per_page=0 would divide-by-zero in the paginator and
        // negatives would drop the LIMIT clause entirely.
        $perPage = max(1, min((int) $request->input('per_page', 15), 50));

        $invoices = $request->user()->transactions()
            ->where('status', Transaction::STATUS_COMPLETED)
            ->with('subscription.plan')
            ->orderByDesc('transaction_date')
            ->paginate($perPage);

        return InvoiceResource::collection($invoices);
    }
}
