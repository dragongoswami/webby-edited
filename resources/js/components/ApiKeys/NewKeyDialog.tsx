import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface NewKeyDialogProps {
    token: string | null;
    onClose: () => void;
}

/**
 * Shown once after key creation: the only time the plaintext key is visible.
 */
export function NewKeyDialog({ token, onClose }: NewKeyDialogProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const copyToken = async () => {
        if (!token) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(token);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = token;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Selection stays available for manual copying.
        }
    };

    return (
        <Dialog open={token !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <KeyRound className="h-6 w-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center">{t('Your new API key')}</DialogTitle>
                    <DialogDescription className="text-center">
                        {t('Use this key to authenticate your API requests.')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="flex items-start justify-between gap-2">
                            <code className="flex-1 break-all font-mono text-sm text-foreground select-all">
                                {token}
                            </code>
                            <Button
                                type="button"
                                variant={copied ? 'default' : 'outline'}
                                size="sm"
                                onClick={copyToken}
                                className="shrink-0"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 me-2" />
                                ) : (
                                    <Copy className="h-4 w-4 me-2" />
                                )}
                                {copied ? t('Copied!') : t('Copy')}
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                            {t("Copy your key now. For security reasons, you won't be able to see it again.")}
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" onClick={onClose} className="w-full sm:w-auto">
                        {t('Done')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
