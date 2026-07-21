import { useRef, useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

type Props = {
    files: File[];
    onChange: (files: File[]) => void;
    maxFiles?: number;
    maxSizeMb?: number;
    accept?: string;
};

export default function AttachmentDropzone({
    files,
    onChange,
    maxFiles = 5,
    maxSizeMb = 10,
    accept,
}: Props) {
    const { t } = useTranslation();
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    function addFiles(list: FileList | null) {
        if (!list) return;
        setError(null);
        const incoming = Array.from(list);
        const tooBig = incoming.find((f) => f.size > maxSizeMb * 1024 * 1024);
        if (tooBig) {
            setError(t(':file exceeds :size MB', { file: tooBig.name, size: String(maxSizeMb) }));
            return;
        }
        const next = [...files, ...incoming].slice(0, maxFiles);
        onChange(next);
    }

    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                className="border-dashed"
            >
                <Paperclip className="h-4 w-4 me-1.5" />
                {t('Attach files')}
            </Button>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept={accept}
                className="hidden"
                onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {files.length > 0 && (
                <ul className="space-y-1 text-sm">
                    {files.map((f, i) => (
                        <li
                            key={i}
                            className="flex items-center justify-between rounded bg-muted px-2 py-1"
                        >
                            <span className="truncate">{f.name}</span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => onChange(files.filter((_, j) => j !== i))}
                                aria-label={t('Remove attachment')}
                            >
                                <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
