import { FormEvent, useState } from 'react';
import { router } from '@inertiajs/react';
import { useTranslation } from '@/contexts/LanguageContext';
import AttachmentDropzone from './AttachmentDropzone';
import RichTextEditor from './RichTextEditor';
import { Button } from '@/components/ui/button';

type Props = {
    action: string;
    disabled?: boolean;
    disabledMessage?: string;
};

function htmlIsEmpty(html: string): boolean {
    const stripped = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim();
    return stripped.length === 0;
}

export default function ReplyComposer({ action, disabled, disabledMessage }: Props) {
    const { t } = useTranslation();
    const [body, setBody] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function submit(e: FormEvent) {
        e.preventDefault();
        if (htmlIsEmpty(body)) return;
        const data = new FormData();
        data.append('body', body);
        files.forEach((f) => data.append('attachments[]', f));
        setProcessing(true);
        setError(null);
        router.post(action, data, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setBody('');
                setFiles([]);
            },
            onError: (errors) => {
                setError(Object.values(errors).flat().join(' ') || t('Failed to send.'));
            },
            onFinish: () => setProcessing(false),
        });
    }

    if (disabled) {
        return (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                {disabledMessage ?? t('Reply to reopen this ticket.')}
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="space-y-3">
            <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder={t('Write your reply… add any new details, screenshots, or logs.')}
                ariaLabel={t('Send reply')}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <AttachmentDropzone files={files} onChange={setFiles} />
            <div className="flex justify-end">
                <Button type="submit" disabled={processing || htmlIsEmpty(body)}>
                    {processing ? t('Sending…') : t('Send reply')}
                </Button>
            </div>
        </form>
    );
}
