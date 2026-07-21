<?php

namespace App\Http\Requests\Support;

use App\Services\Tickets\TicketAttachmentService;
use Illuminate\Foundation\Http\FormRequest;

class ReplyTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $svc = app(TicketAttachmentService::class);

        return [
            'body' => ['required', 'string', 'max:50000'],
            'attachments' => ['nullable', 'array', 'max:'.$svc->maxAttachmentsPerMessage()],
            'attachments.*' => [
                'file',
                'mimes:'.implode(',', $svc->allowedTypes()),
                'max:'.($svc->maxSizeMb() * 1024),
            ],
        ];
    }
}
