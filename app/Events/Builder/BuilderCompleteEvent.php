<?php

namespace App\Events\Builder;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BuilderCompleteEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $sessionId,
        public ?string $eventId,
        public int $iterations,
        public int $tokensUsed,
        public bool $filesChanged,
        public ?int $promptTokens = null,
        public ?int $completionTokens = null,
        // Per-run token usage (this build/turn only). Credits are deducted from
        // these, not the cumulative tokensUsed above — otherwise a multi-turn
        // chat session is re-charged the cumulative total on every turn.
        public ?int $runTokensUsed = null,
        public ?int $runPromptTokens = null,
        public ?int $runCompletionTokens = null,
        public ?string $model = null,
        public ?string $buildStatus = null,
        public ?string $buildMessage = null,
        public bool $buildRequired = false,
        public ?string $message = null,
        public bool $shouldBroadcast = true,
        public ?array $qualityCheck = null,
        public bool $aeoGenerated = false,
    ) {}

    public function broadcastWhen(): bool
    {
        return $this->shouldBroadcast;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('session.'.$this->sessionId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'complete';
    }

    public function broadcastWith(): array
    {
        $data = [
            'iterations' => $this->iterations,
            'tokens_used' => $this->tokensUsed,
            'files_changed' => $this->filesChanged,
            'build_required' => $this->buildRequired,
        ];

        if ($this->message !== null) {
            $message = $this->message;
            if (strlen($message) > 8000) {
                $message = mb_strcut($message, 0, 8000, 'UTF-8')."\n\n[truncated]";
            }
            $data['message'] = $message;
        }

        if ($this->buildStatus !== null) {
            $data['build_status'] = $this->buildStatus;
        }

        if ($this->buildMessage !== null) {
            $data['build_message'] = $this->buildMessage;
        }

        if ($this->promptTokens !== null) {
            $data['prompt_tokens'] = $this->promptTokens;
        }

        if ($this->completionTokens !== null) {
            $data['completion_tokens'] = $this->completionTokens;
        }

        if ($this->model !== null) {
            $data['model'] = $this->model;
        }

        if ($this->qualityCheck !== null) {
            $data['quality_check'] = $this->qualityCheck;
        }

        if ($this->aeoGenerated) {
            $data['aeo_generated'] = true;
        }

        return $data;
    }
}
