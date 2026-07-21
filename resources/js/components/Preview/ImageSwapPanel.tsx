import { useState, useRef, useCallback } from 'react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Upload, Loader2, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import type { InspectorElement } from '@/types/inspector';

interface ImageSwapPanelProps {
    element: InspectorElement;
    projectId: string;
    storageEnabled: boolean;
    maxFileSizeMb: number;
    onApply: (newSrc: string) => void;
    onClose: () => void;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export function ImageSwapPanel({ element, projectId, storageEnabled, maxFileSizeMb, onApply, onClose }: ImageSwapPanelProps) {
    const { t } = useTranslation();
    const [url, setUrl] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentSrc = element.attributes?.src || '';

    const handleFileSelect = useCallback(async (file: File) => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            toast.error(t('Invalid image format'));
            return;
        }

        if (file.size > maxFileSizeMb * 1024 * 1024) {
            toast.error(t('Failed to upload file'));
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await axios.post(`/project/${projectId}/files`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const fileUrl = res.data.file?.url || res.data.url;
            if (fileUrl) {
                setUploadedUrl(fileUrl);
                setUrl('');
            }
        } catch {
            toast.error(t('Failed to upload file'));
        } finally {
            setUploading(false);
        }
    }, [projectId, maxFileSizeMb, t]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleApply = () => {
        const newSrc = uploadedUrl || url.trim();
        if (!newSrc) return;
        onApply(newSrc);
        toast.success(t('Image updated'));
    };

    const previewSrc = uploadedUrl || url.trim() || currentSrc;

    return (
        <div className="fixed z-[99998] top-12 right-4 w-72 bg-background border rounded-lg shadow-xl animate-in slide-in-from-right-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b">
                <div className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('Swap Image')}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            <div className="p-3 space-y-3">
                {/* Preview */}
                <div className="aspect-video rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center">
                    {previewSrc ? (
                        <img src={previewSrc} alt="" className="max-w-full max-h-full object-contain" />
                    ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                    )}
                </div>

                {/* Upload zone */}
                {storageEnabled && (
                    <div
                        className={`border-2 border-dashed rounded-md p-3 text-center cursor-pointer transition-colors ${
                            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                        }`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {uploading ? (
                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                        ) : (
                            <>
                                <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">{t('Drop image here or click to browse')}</p>
                            </>
                        )}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_TYPES.join(',')}
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileSelect(file);
                                e.target.value = '';
                            }}
                        />
                    </div>
                )}

                {/* URL input */}
                <div>
                    <Label className="text-xs">{t('Image URL')}</Label>
                    <Input
                        type="url"
                        placeholder={t('Enter image URL')}
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); setUploadedUrl(null); }}
                        className="mt-1 h-8 text-xs"
                    />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={onClose}>
                        {t('Cancel')}
                    </Button>
                    <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleApply} disabled={!uploadedUrl && !url.trim()}>
                        {t('Apply')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
