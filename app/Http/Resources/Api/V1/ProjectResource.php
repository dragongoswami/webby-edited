<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Project */
class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Explicit field list: never serialize the model directly (api_token,
        // conversation_history and connection ids must not leak).
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'build_status' => $this->build_status,
            'output_target' => $this->output_target,
            'is_public' => $this->is_public,
            'subdomain' => $this->subdomain,
            'custom_domain' => $this->custom_domain,
            'public_url' => $this->getPublicUrl(),
            'published_at' => $this->published_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
