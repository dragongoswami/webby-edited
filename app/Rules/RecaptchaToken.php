<?php

namespace App\Rules;

use App\Models\SystemSetting;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;
use ReCaptcha\ReCaptcha;
use ReCaptcha\RequestMethod;

class RecaptchaToken implements ValidationRule
{
    protected float $minScore;

    protected ?RequestMethod $requestMethod;

    public function __construct(float $minScore = 0.5, ?RequestMethod $requestMethod = null)
    {
        $this->minScore = $minScore;
        $this->requestMethod = $requestMethod;
    }

    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Skip validation if reCAPTCHA is disabled
        if (! SystemSetting::get('recaptcha_enabled', false)) {
            return;
        }

        $secretKey = SystemSetting::get('recaptcha_secret_key');
        if (empty($secretKey)) {
            $fail('reCAPTCHA is not configured properly.');

            return;
        }

        $recaptcha = new ReCaptcha($secretKey, $this->requestMethod);
        $response = $recaptcha
            ->setExpectedHostname(request()->getHost())
            ->verify($value, request()->ip());

        if (! $response->isSuccess()) {
            $fail('reCAPTCHA verification failed. Please try again.');

            return;
        }

        // v3 score check (0.0 = bot, 1.0 = human)
        if ($response->getScore() !== null && $response->getScore() < $this->minScore) {
            $fail('reCAPTCHA verification failed. Please try again.');
        }
    }
}
