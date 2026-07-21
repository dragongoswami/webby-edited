import { useRef } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LanguageContext';
import { useChatFileUpload } from '@/hooks/useChatFileUpload';
import type { AttachedFile } from '@/types/chat';
import { toast } from 'sonner';
import {
    validateFile,
    isVideoFile,
    getAllAllowedMimeTypes,
    FILE_CONFIG,
} from '@/lib/fileValidation';

interface ChatUploadButtonProps {
    projectId: string;
    maxFileSizeMb: number;
    allowedTypes: string[] | null;
    disabled?: boolean;
    onFileUploaded: (file: AttachedFile) => void;
    maxFiles?: number;
}

export function ChatUploadButton({
    projectId,
    maxFileSizeMb,
    allowedTypes,
    disabled,
    onFileUploaded,
    maxFiles = 5,
}: ChatUploadButtonProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { uploadFile, isUploading } = useChatFileUpload({
        projectId,
        maxFileSizeMb,
        allowedTypes,
    });

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);

        // Check file count limit
        if (fileArray.length > maxFiles) {
            toast.error(t('Maximum :count files allowed per message', { count: maxFiles }));
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Validate ALL files before uploading any
        const errors: string[] = [];
        for (const file of fileArray) {
            const result = validateFile(file);
            if (!result.valid) {
                errors.push(result.error!);
            }
        }

        if (errors.length > 0) {
            toast.error(errors[0]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Upload all files
        let uploadedCount = 0;
        for (const file of fileArray) {
            const result = await uploadFile(file);
            if (result) {
                // Mark videos so backend knows not to send to AI
                if (isVideoFile(file.type)) {
                    result.is_video = true;
                }
                onFileUploaded(result);
                uploadedCount++;
            }
        }

        if (uploadedCount === 1) {
            const file = fileArray[0];
            if (isVideoFile(file.type)) {
                toast.success(t('Video attached. Tell the AI where to place it on your site.'));
            } else {
                toast.success(t('File attached'));
            }
        } else if (uploadedCount > 1) {
            toast.success(t(':count files attached', { count: uploadedCount }));
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                multiple
                disabled={disabled || isUploading}
                accept={getAllAllowedMimeTypes().join(',')}
            />
            <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClick}
                disabled={disabled || isUploading}
                className="h-10 w-10 p-0"
                title={t('Attach file')}
                aria-label={t('Attach file')}
            >
                {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Paperclip className="h-3.5 w-3.5" />
                )}
            </Button>
        </>
    );
}