<?php

namespace App\Support;

use App\Models\SystemSetting;

/**
 * Applies the database-stored email settings to Laravel's runtime mail config.
 *
 * This is the single source of truth for mapping the admin "Email" settings
 * group onto the framework's `mail.*` config. It is used both at request boot
 * (AppServiceProvider) and by the admin Test Email action, so the driver the
 * operator selects is honoured consistently for every email the app sends
 * (verification, notifications, etc.) — not just the test message.
 */
class MailConfigurator
{
    /**
     * Read the `email` settings group and apply it to the mail config.
     */
    public static function apply(): void
    {
        $settings = SystemSetting::getGroup('email');

        if (empty($settings)) {
            return;
        }

        // Apply the selected mail driver app-wide. This must run for ALL
        // drivers (sendmail, log, smtp, …), not just SMTP — otherwise the app
        // falls back to the .env/default mailer for real emails while only the
        // admin "Test Email" path (which always sets this) works.
        if (! empty($settings['mail_mailer'])) {
            config(['mail.default' => $settings['mail_mailer']]);
        }

        // Apply SMTP credentials only when an SMTP host is configured.
        if (! empty($settings['smtp_host'])) {
            config([
                'mail.mailers.smtp.host' => $settings['smtp_host'],
                'mail.mailers.smtp.port' => (int) ($settings['smtp_port'] ?? 587),
                'mail.mailers.smtp.username' => $settings['smtp_username'] ?? null,
                'mail.mailers.smtp.password' => $settings['smtp_password'] ?? null,
                'mail.mailers.smtp.encryption' => ($settings['smtp_encryption'] ?? 'tls') === 'none'
                    ? null
                    : ($settings['smtp_encryption'] ?? 'tls'),
            ]);
        }

        // Apply the from address / name when configured.
        if (! empty($settings['mail_from_address'])) {
            config([
                'mail.from.address' => $settings['mail_from_address'],
                'mail.from.name' => $settings['mail_from_name'] ?? config('app.name'),
            ]);
        }
    }
}
