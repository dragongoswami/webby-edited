type Translate = (key: string, params?: Record<string, string | number>) => string;

function diffInDays(dateString: string): number {
    const date = new Date(dateString);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatEditedTime(t: Translate, dateString: string): string {
    const diffDays = diffInDays(dateString);
    if (diffDays <= 0) return t('Edited today');
    if (diffDays === 1) return t('Edited yesterday');
    return t('Edited :days days ago', { days: diffDays });
}

export function formatDeletedTime(t: Translate, dateString: string): string {
    const diffDays = diffInDays(dateString);
    if (diffDays <= 0) return t('Deleted today');
    if (diffDays === 1) return t('Deleted yesterday');
    return t('Deleted :days days ago', { days: diffDays });
}
