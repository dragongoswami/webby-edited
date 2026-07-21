import { useEffect, useState } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Database, Loader2 } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface SupabaseConnectionOption {
    id: number;
    label: string;
}

interface DatabaseCardProps {
    projectId: string;
    connectionId: number | null;
    canUseDatabase: boolean;
}

/**
 * Attach, switch, or detach the project's BYOD Supabase connection.
 *
 * The connection library comes from the existing GET /supabase-connections
 * endpoint (intentionally not plan-gated, so a downgraded user still sees the
 * label of the currently attached connection and can detach it). Switching or
 * detaching never migrates or deletes data — the confirm dialog says so.
 */
export function DatabaseCard({ projectId, connectionId, canUseDatabase }: DatabaseCardProps) {
    const { t } = useTranslation();

    const [connections, setConnections] = useState<SupabaseConnectionOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selected, setSelected] = useState<number | null>(connectionId);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    // Re-seed the selection when Inertia refreshes props (e.g. after a save).
    useEffect(() => {
        setSelected(connectionId);
    }, [connectionId]);

    useEffect(() => {
        let cancelled = false;
        axios
            .get<SupabaseConnectionOption[]>('/supabase-connections')
            .then((response) => {
                if (!cancelled) setConnections(response.data);
            })
            .catch(() => {
                if (!cancelled) toast.error(t('Failed to load database connections'));
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isDirty = selected !== connectionId;

    const submit = () => {
        setIsSaving(true);
        router.put(
            `/project/${projectId}/settings/database`,
            { supabase_connection_id: selected },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(t('Database updated. Changes take effect on the next build.'));
                },
                onError: (errors) => {
                    const msg = Object.values(errors).flat().filter(Boolean).join(' ');
                    toast.error(msg || t('Failed to update database'));
                },
                onFinish: () => {
                    setIsSaving(false);
                },
            }
        );
    };

    const handleSave = () => {
        // Switching away from (or detaching) an existing connection points the
        // app at a different database — data does not migrate. Confirm first.
        if (connectionId !== null && selected !== connectionId) {
            setConfirmOpen(true);
            return;
        }
        submit();
    };

    const isDetaching = selected === null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    {t('Database')}
                </CardTitle>
                <CardDescription>
                    {t('Connect one of your database connections so the AI can create tables and store data for this project.')}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="project-database">{t('Connection')}</Label>
                            <Select
                                value={selected?.toString() ?? 'none'}
                                onValueChange={(value) =>
                                    setSelected(value === 'none' ? null : parseInt(value, 10))
                                }
                            >
                                <SelectTrigger id="project-database">
                                    {/* The placeholder only renders when the current value matches
                                        no item — i.e. the connection list failed to load while a
                                        connection is attached ("none" always exists, so a null
                                        selection never shows it). */}
                                    <SelectValue placeholder={t('Connection unavailable')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">
                                        <div className="flex items-center gap-2">
                                            <Database className="h-4 w-4 shrink-0" />
                                            <span>{t('No database')}</span>
                                        </div>
                                    </SelectItem>
                                    {connections.map((connection) => (
                                        <SelectItem
                                            key={connection.id}
                                            value={connection.id.toString()}
                                            // Detach-only when the plan lost the capability:
                                            // the current connection stays selectable so the
                                            // Select can render it, everything else locks.
                                            disabled={!canUseDatabase && connection.id !== connectionId}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Database className="h-4 w-4 shrink-0" />
                                                <span>{connection.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {canUseDatabase
                                    ? t('Changes take effect on the next build.')
                                    : t('Your plan does not include the database capability. You can still detach the current connection.')}
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
                                {isSaving && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                                {t('Save Changes')}
                            </Button>
                        </div>
                    </>
                )}

                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>
                                {isDetaching ? t('Detach database?') : t('Change database?')}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {isDetaching
                                    ? t('Your data is not deleted. Tables created on the current database stay there, but this project will no longer use a database.')
                                    : t('Your data does not migrate. Tables created on the current database stay there, and this project will start with a fresh, empty schema on the selected database.')}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={submit}>
                                {isDetaching ? t('Detach') : t('Change database')}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}
