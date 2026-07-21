<?php

namespace App\Support;

/**
 * The unconditional dangerous/active-content file-type floor, applied to every
 * user upload regardless of any per-plan or admin-configured allowlist. Shared
 * by project file uploads and ticket attachments so the floor can never drift
 * between the two. This matters more now that uploads can be served from object
 * storage with their real Content-Type (e.g. an SVG would render inline via a
 * presigned URL), bypassing the local proxy's `.bin` + Content-Disposition guard.
 */
class DangerousFileTypes
{
    /** MIME types that are never accepted, regardless of any allowlist. */
    public const BLOCKED_MIME_TYPES = [
        'application/x-php', 'text/x-php', 'application/x-httpd-php', 'application/php',
        'text/html', 'application/xhtml+xml',
        'image/svg+xml',
        'application/x-executable', 'application/x-msdownload', 'application/x-dosexec',
        'application/x-sh', 'application/x-csh', 'application/x-perl', 'application/x-python',
        'text/javascript', 'application/javascript', 'application/x-javascript',
        'application/java-archive', 'application/x-msi',
    ];

    /** Extensions that are never accepted, regardless of any allowlist. */
    public const BLOCKED_EXTENSIONS = [
        'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'phar', 'pht',
        'asp', 'aspx', 'jsp', 'jspx', 'cgi', 'pl', 'py', 'rb',
        'sh', 'bash', 'zsh', 'exe', 'bat', 'cmd', 'com', 'msi', 'scr',
        'js', 'mjs', 'cjs', 'jar', 'html', 'htm', 'xhtml', 'svg', 'htaccess',
    ];

    /**
     * Whether an upload is a dangerous/active-content type that must never be
     * accepted, checked by both detected MIME type and the client extension.
     */
    public static function isBlocked(string $mimeType, ?string $originalName): bool
    {
        if (in_array(strtolower(trim($mimeType)), self::BLOCKED_MIME_TYPES, true)) {
            return true;
        }

        if ($originalName !== null) {
            // Strip trailing dots and whitespace before reading the extension.
            // Filesystems normalize "shell.php." -> "shell.php" on write, so the
            // raw client name must be normalized the same way; otherwise pathinfo
            // reports an empty extension and the floor is bypassed. The trim()
            // additionally defeats whitespace tricks like "shell.php ".
            $normalized = rtrim($originalName, ". \t\n\r\0\x0B");
            $ext = strtolower(trim(pathinfo($normalized, PATHINFO_EXTENSION)));
            if ($ext !== '' && in_array($ext, self::BLOCKED_EXTENSIONS, true)) {
                return true;
            }
        }

        return false;
    }
}
