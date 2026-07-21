<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Transaction */
class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'status' => $this->status,
            'type' => $this->type,
            'payment_method' => $this->payment_method,
            'plan' => $this->subscription?->plan?->name,
            'transaction_date' => $this->transaction_date?->toIso8601String(),
        ];
    }
}
