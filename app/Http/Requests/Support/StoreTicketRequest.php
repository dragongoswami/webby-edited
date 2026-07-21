<?php

namespace App\Http\Requests\Support;

use App\Services\Tickets\TicketAttachmentService;
use Illuminate\Foundation\Http\FormRequest;

class StoreTicketRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $svc = app(TicketAttachmentService::class);

        return [
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:50000'],
            'project_id' => ['nullable', 'uuid', 'exists:projects,id'],
            'attachments' => ['nullable', 'array', 'max:'.$svc->maxAttachmentsPerMessage()],
            'attachments.*' => [
                'file',
                'mimes:'.implode(',', $svc->allowedTypes()),
                'max:'.($svc->maxSizeMb() * 1024),
            ],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($v) {
            $pid = $this->input('project_id');
            if ($pid && ! $this->user()->projects()->whereKey($pid)->exists()) {
                $v->errors()->add('project_id', __('You do not own this project.'));
            }
        });
    }
}
