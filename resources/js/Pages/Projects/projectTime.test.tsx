import { describe, it, expect } from 'vitest';
import { formatEditedTime, formatDeletedTime } from './projectTime';

// Pass-through t() that interpolates :params, mirroring the app's translator.
const t = (key: string, params?: Record<string, unknown>) => {
    let out = key;
    if (params) {
        for (const [k, v] of Object.entries(params)) out = out.replace(`:${k}`, String(v));
    }
    return out;
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

describe('formatEditedTime', () => {
    it('returns "Edited today" for now', () => {
        expect(formatEditedTime(t, daysAgo(0))).toBe('Edited today');
    });
    it('returns "Edited yesterday" for 1 day ago', () => {
        expect(formatEditedTime(t, daysAgo(1))).toBe('Edited yesterday');
    });
    it('returns "Edited :days days ago" for 3 days ago', () => {
        expect(formatEditedTime(t, daysAgo(3))).toBe('Edited 3 days ago');
    });
});

describe('formatDeletedTime', () => {
    it('returns "Deleted today" for now', () => {
        expect(formatDeletedTime(t, daysAgo(0))).toBe('Deleted today');
    });
    it('returns "Deleted yesterday" for 1 day ago', () => {
        expect(formatDeletedTime(t, daysAgo(1))).toBe('Deleted yesterday');
    });
    it('returns "Deleted :days days ago" for 5 days ago', () => {
        expect(formatDeletedTime(t, daysAgo(5))).toBe('Deleted 5 days ago');
    });
    it('never leaks the word "Edited"', () => {
        expect(formatDeletedTime(t, daysAgo(2))).not.toContain('Edited');
    });
});
