<?php

namespace App\Http\Resources\Api\V1;

use App\Models\ProjectFile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProjectFile */
class ProjectFileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Explicit allowlist — internal storage details (path, disk, raw
        // stored filename) are never exposed.
        return [
            'id' => $this->id,
            'name' => $this->original_filename,
            'size' => $this->size,
            'mime_type' => $this->mime_type,
            'source' => $this->source,
            'checksum' => $this->checksum,
            'url' => $this->getApiUrl(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
