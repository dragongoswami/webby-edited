// File upload configuration - Lovable-style simple approach
// Images: sent to AI for vision, Documents: stored for reference, Videos: stored for placement

export type FileCategory = 'images' | 'documents' | 'videos';

interface FileConfig {
    mimes: string[];
    extensions: string[];
    maxSizeBytes: number;
    label: string;
    allowedMessage: string;
}

export const FILE_CONFIG: Record<FileCategory, FileConfig> = {
    images: {
        mimes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
        maxSizeBytes: 5 * 1024 * 1024, // 5MB
        label: 'Images',
        allowedMessage: 'JPG, PNG, GIF, WebP, SVG up to 5MB',
    },
    documents: {
        mimes: [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown',
        ],
        extensions: ['.pdf', '.doc', '.docx', '.txt', '.md'],
        maxSizeBytes: 1 * 1024 * 1024, // 1MB
        label: 'Documents',
        allowedMessage: 'PDF, DOC, DOCX, TXT, MD up to 1MB',
    },
    videos: {
        mimes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
        extensions: ['.mp4', '.webm', '.ogg', '.mov'],
        maxSizeBytes: 50 * 1024 * 1024, // 50MB
        label: 'Videos',
        allowedMessage: 'MP4, WebM, MOV up to 50MB (stored, not sent to AI)',
    },
};

export function getFileCategory(mimeType: string): FileCategory | null {
    if (FILE_CONFIG.images.mimes.includes(mimeType)) return 'images';
    if (FILE_CONFIG.documents.mimes.includes(mimeType)) return 'documents';
    if (FILE_CONFIG.videos.mimes.includes(mimeType)) return 'videos';
    return null;
}

export function isAllowedFile(mimeType: string): boolean {
    return getFileCategory(mimeType) !== null;
}

export function getMaxFileSize(mimeType: string): number {
    const category = getFileCategory(mimeType);
    if (!category) return 0;
    return FILE_CONFIG[category].maxSizeBytes;
}

export function getAllowedExtensions(): string[] {
    return [
        ...FILE_CONFIG.images.extensions,
        ...FILE_CONFIG.documents.extensions,
        ...FILE_CONFIG.videos.extensions,
    ];
}

export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function validateFile(file: File): { valid: boolean; error?: string } {
    const category = getFileCategory(file.type);

    if (!category) {
        return {
            valid: false,
            error: `File type not allowed: ${file.name}. Allowed: Images (JPG, PNG, GIF), Documents (PDF, DOC, TXT, MD), Videos (MP4, WebM)`,
        };
    }

    const config = FILE_CONFIG[category];
    if (file.size > config.maxSizeBytes) {
        const maxSize = formatFileSize(config.maxSizeBytes);
        if (category === 'videos') {
            return {
                valid: false,
                error: `Video too large: ${file.name} (max ${maxSize}). Videos are stored for placement but not sent to AI.`,
            };
        }
        return {
            valid: false,
            error: `File too large: ${file.name} (max ${maxSize})`,
        };
    }

    return { valid: true };
}

export function isVideoFile(mimeType: string): boolean {
    return FILE_CONFIG.videos.mimes.includes(mimeType);
}

export function isImageFile(mimeType: string): boolean {
    return FILE_CONFIG.images.mimes.includes(mimeType);
}

export function getAllAllowedMimeTypes(): string[] {
    return [
        ...FILE_CONFIG.images.mimes,
        ...FILE_CONFIG.documents.mimes,
        ...FILE_CONFIG.videos.mimes,
    ];
}

// Alias for backwards compatibility
export const ALLOWED_FILE_TYPES = FILE_CONFIG;