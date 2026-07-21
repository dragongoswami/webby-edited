// Project File Types
export interface ProjectFile {
    id: number;
    project_id: string;
    filename: string;
    original_filename: string;
    path: string;
    mime_type: string;
    size: number;
    human_size: string;
    source: 'dashboard' | 'app';
    is_image: boolean;
    is_pdf: boolean;
    is_video: boolean;
    is_audio: boolean;
    url: string;
    created_at: string;
    updated_at?: string;
}

// Storage Usage Types
export interface StorageUsage {
    used_bytes: number;
    used_mb: number;
    limit_mb: number | null;
    unlimited: boolean;
    remaining_bytes: number;
    percentage: number;
}

// Plan Storage Limits
export interface PlanStorageLimits {
    file_storage_enabled: boolean;
    max_storage_mb: number | null;
    max_file_size_mb: number;
    allowed_file_types: string[] | null;
    unlimited_storage: boolean;
}

// Pagination Types
export interface Pagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    has_more: boolean;
}

// File Manager Page Props
export interface FileManagerPageProps {
    projects: Array<{
        id: string;
        name: string;
        files_count: number;
        storage_used: number;
    }>;
    storageUsage: StorageUsage;
    planLimits: PlanStorageLimits;
}
