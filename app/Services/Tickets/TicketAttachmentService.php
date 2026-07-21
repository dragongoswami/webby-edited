<?php

namespace App\Services\Tickets;

use App\Models\SystemSetting;
use App\Models\TicketAttachment;
use App\Models\TicketMessage;
use App\Services\Storage\BucketStorageManager;
use App\Support\DangerousFileTypes;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class TicketAttachmentService
{
    /**
     * Stores uploaded files under a uuid name with a fixed `.bin` extension.
     * The original filename (with its real extension) is kept in the DB and
     * used when streaming back to the user, so files on disk cannot be
     * executed as PHP/script if the storage directory is ever exposed.
     *
     * Returns the disk written to and the on-disk paths. The caller is expected
     * to delete them (on that disk) if the surrounding DB transaction rolls back.
     * If any single file or row insert fails inside this call, every file written
     * so far is deleted before the exception propagates.
     *
     * Files route to the active storage-provider's bucket when one is installed
     * and active, otherwise to the local disk (same system-wide gate as project
     * files). The chosen disk is persisted per row, so existing local attachments
     * keep serving after a provider is switched on.
     *
     * @param  UploadedFile[]  $files
     * @return array{disk: string, paths: string[]}
     */
    public function store(TicketMessage $message, array $files): array
    {
        $manager = app(BucketStorageManager::class);
        $disk = $manager->uploadDisk();
        $writtenPaths = [];

        try {
            foreach ($files as $file) {
                if (! $file instanceof UploadedFile) {
                    continue;
                }

                // Unconditional dangerous-type floor — never accept active content
                // (php/html/svg/exe…) regardless of the admin-configured allowlist.
                // Critical now that attachments can be served from object storage with
                // their real Content-Type via a presigned URL (an inline SVG would run
                // script), bypassing the local proxy's .bin/Content-Disposition guard.
                if (DangerousFileTypes::isBlocked($file->getMimeType() ?: '', $file->getClientOriginalName())) {
                    throw new \InvalidArgumentException('This file type is not allowed for security reasons.');
                }

                $dir = 'tickets/'.$message->ticket_id;
                $name = (string) Str::uuid().'.bin';
                $path = $dir.'/'.$name;

                $manager->disk($disk)->putFileAs($dir, $file, $name);
                $writtenPaths[] = $path;

                TicketAttachment::create([
                    'ticket_message_id' => $message->id,
                    'disk' => $disk,
                    'path' => $path,
                    'original_name' => $this->sanitizeOriginalName($file->getClientOriginalName()),
                    'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                    'size_bytes' => $file->getSize() ?: 0,
                ]);
            }

            return ['disk' => $disk, 'paths' => $writtenPaths];
        } catch (Throwable $e) {
            $this->deletePaths($writtenPaths, $disk);
            throw $e;
        }
    }

    public function deletePaths(array $paths, string $disk): void
    {
        if (empty($paths)) {
            return;
        }

        try {
            app(BucketStorageManager::class)->disk($disk)->delete($paths);
        } catch (Throwable $e) {
            // Provider uninstalled / disk unresolvable — don't mask the original
            // error (this runs inside rollback catch blocks). Log and move on.
            Log::warning("Could not delete ticket attachment paths on disk {$disk}: ".$e->getMessage());
        }
    }

    public function stream(TicketAttachment $attachment): StreamedResponse
    {
        try {
            return app(BucketStorageManager::class)->disk($attachment->disk ?: 'local')->download(
                $attachment->path,
                $attachment->original_name,
                ['Content-Type' => $attachment->mime_type ?: 'application/octet-stream']
            );
        } catch (Throwable $e) {
            // The storage provider this attachment lives on is no longer installed.
            abort(404, __('Attachment storage is no longer available.'));
        }
    }

    public function allowedTypes(): array
    {
        $types = SystemSetting::get('support.allowed_attachment_types', ['png', 'jpg', 'jpeg', 'pdf', 'txt', 'log', 'zip']);

        return is_array($types) ? $types : ['png', 'jpg', 'jpeg', 'pdf', 'txt', 'log', 'zip'];
    }

    public function maxSizeMb(): int
    {
        return (int) SystemSetting::get('support.max_attachment_size_mb', 10);
    }

    public function maxAttachmentsPerMessage(): int
    {
        return (int) SystemSetting::get('support.max_attachments_per_message', 5);
    }

    /**
     * Strip path components and disallowed chars from a user-supplied filename
     * before storing it. The result is only ever used as the download filename.
     */
    private function sanitizeOriginalName(string $name): string
    {
        $name = basename($name);
        $name = preg_replace('/[\x00-\x1f\x7f]/u', '', $name) ?? '';
        $name = trim($name);

        return $name === '' ? 'file' : mb_substr($name, 0, 255);
    }
}
