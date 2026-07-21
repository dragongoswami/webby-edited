import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';
import {
    Bold,
    Italic,
    Strikethrough,
    List,
    ListOrdered,
    Code,
    Quote,
    Link as LinkIcon,
    Heading2,
} from 'lucide-react';

type Props = {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    minHeight?: number;
    invalid?: boolean;
    ariaLabel?: string;
};

export default function RichTextEditor({
    value,
    onChange,
    placeholder,
    minHeight = 140,
    invalid = false,
    ariaLabel,
}: Props) {
    const { t } = useTranslation();
    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                link: false,
            }),
            Placeholder.configure({ placeholder: placeholder ?? '' }),
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
            }),
        ],
        content: value,
        editorProps: {
            attributes: {
                class: cn(
                    'prose prose-sm dark:prose-invert max-w-none focus:outline-none',
                    'px-3 py-2',
                ),
                style: `min-height: ${minHeight}px`,
                ...(ariaLabel ? { 'aria-label': ariaLabel } : {}),
            },
        },
        onUpdate({ editor }) {
            const html = editor.getHTML();
            onChange(html === '<p></p>' ? '' : html);
        },
        immediatelyRender: false,
    });

    // Keep editor in sync when parent resets the value (e.g. after submit).
    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        const next = value || '<p></p>';
        if (current !== next) {
            editor.commands.setContent(next, { emitUpdate: false });
        }
    }, [value, editor]);

    if (!editor) {
        return (
            <div
                className={cn(
                    'rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground',
                    invalid && 'border-destructive',
                )}
                style={{ minHeight }}
            >
                {placeholder}
            </div>
        );
    }

    const openLinkDialog = () => {
        const previous = editor.getAttributes('link').href as string | undefined;
        setLinkUrl(previous ?? 'https://');
        setLinkDialogOpen(true);
    };

    const applyLink = (e: FormEvent) => {
        e.preventDefault();
        const url = linkUrl.trim();
        if (url === '' || url === 'https://') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
        }
        setLinkDialogOpen(false);
    };

    const removeLink = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run();
        setLinkDialogOpen(false);
    };

    const btn = (active: boolean) =>
        cn(
            'h-9 w-9 p-0',
            active && 'bg-muted text-foreground',
        );

    return (
        <>
            <div
                className={cn(
                    'rounded-md border border-input bg-background focus-within:ring-[3px] focus-within:ring-ring/50',
                    invalid && 'border-destructive',
                )}
            >
                <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label={t('Bold')}>
                        <Bold className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label={t('Italic')}>
                        <Italic className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()} aria-label={t('Strikethrough')}>
                        <Strikethrough className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label={t('Heading')}>
                        <Heading2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label={t('Bullet list')}>
                        <List className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label={t('Numbered list')}>
                        <ListOrdered className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label={t('Quote')}>
                        <Quote className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()} aria-label={t('Code block')}>
                        <Code className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className={btn(editor.isActive('link'))} onClick={openLinkDialog} aria-label={t('Link')}>
                        <LinkIcon className="h-3.5 w-3.5" />
                    </Button>
                </div>
                <EditorContent editor={editor} />
            </div>

            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Insert link')}</DialogTitle>
                        <DialogDescription>{t('Paste or type the URL to link to.')}</DialogDescription>
                    </DialogHeader>
                    <form id="link-form" onSubmit={applyLink} className="space-y-3 py-2">
                        <Label htmlFor="link-url">{t('URL')}</Label>
                        <Input
                            id="link-url"
                            type="url"
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            autoFocus
                            placeholder="https://"
                        />
                    </form>
                    <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                        <Button type="button" variant="outline" onClick={removeLink} disabled={!editor.isActive('link')}>
                            {t('Remove link')}
                        </Button>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setLinkDialogOpen(false)}>
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" form="link-form">
                                {t('Apply')}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
