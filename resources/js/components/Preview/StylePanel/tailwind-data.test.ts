import { describe, expect, it } from 'vitest';
import { findClassValue, findColorValue, findExactClass } from './tailwind-data';

describe('findClassValue', () => {
    it('returns the suffix after the matched prefix', () => {
        expect(findClassValue(['gap-4'], 'gap-')).toBe('4');
        expect(findClassValue(['leading-tight'], 'leading-')).toBe('tight');
    });

    it('scopes matches to the given breakpoint', () => {
        expect(findClassValue(['md:gap-4'], 'gap-', 'md')).toBe('4');
        // base class is not matched when a breakpoint is requested
        expect(findClassValue(['gap-4'], 'gap-', 'md')).toBeNull();
        // breakpoint-scoped class is not matched at base
        expect(findClassValue(['md:gap-4'], 'gap-', '')).toBeNull();
    });

    it('matches a hyphen-free prefix via the startsWith branch (the dedicated exact-match arm is unreachable)', () => {
        // NOTE: when cls === bp+prefix, cls.startsWith(bp+prefix) is trivially
        // true, so the first branch always wins and returns cls.slice(...) === ''.
        // The second "exact match" arm's `return prefix` can never execute.
        expect(findClassValue(['flex'], 'flex')).toBe('');
        expect(findClassValue(['md:flex'], 'flex', 'md')).toBe('');
        // a prefix containing '-' never matches when there is no suffix
        expect(findClassValue(['flex'], 'flex-')).toBeNull();
    });

    it('returns the first match when multiple classes share the prefix', () => {
        expect(findClassValue(['gap-2', 'gap-4'], 'gap-')).toBe('2');
    });

    it('returns an empty string (not null) for a bare-prefix class', () => {
        expect(findClassValue(['gap-'], 'gap-')).toBe('');
    });

    it('returns null when nothing matches', () => {
        expect(findClassValue(['p-4', 'text-lg'], 'gap-')).toBeNull();
    });
});

describe('findExactClass', () => {
    it('returns the matching value found in classes', () => {
        expect(findExactClass(['text-center'], ['text-left', 'text-center', 'text-right'])).toBe('text-center');
    });

    it('iterates possibleValues order, not class order', () => {
        expect(findExactClass(['text-right', 'text-left'], ['text-left', 'text-center', 'text-right'])).toBe('text-left');
    });

    it('scopes matches to the given breakpoint', () => {
        expect(findExactClass(['md:text-center'], ['text-left', 'text-center'], 'md')).toBe('text-center');
        expect(findExactClass(['text-center'], ['text-center'], 'md')).toBeNull();
    });

    it('returns null when nothing matches', () => {
        expect(findExactClass(['p-4'], ['text-left', 'text-center'])).toBeNull();
        expect(findExactClass(['text-center'], [])).toBeNull();
    });
});

describe('findColorValue', () => {
    it('matches family-shade color classes', () => {
        expect(findColorValue(['text-blue-600'], 'text-')).toBe('blue-600');
        expect(findColorValue(['bg-red-50'], 'bg-')).toBe('red-50');
    });

    it('matches family-shade with an opacity suffix', () => {
        expect(findColorValue(['text-blue-500/50'], 'text-')).toBe('blue-500/50');
    });

    it('matches the special color values', () => {
        expect(findColorValue(['text-white'], 'text-')).toBe('white');
        expect(findColorValue(['text-black'], 'text-')).toBe('black');
        expect(findColorValue(['text-transparent'], 'text-')).toBe('transparent');
    });

    it('guards against false positives from non-color classes sharing the prefix', () => {
        expect(findColorValue(['text-center'], 'text-')).toBeNull();
        expect(findColorValue(['border-2'], 'border-')).toBeNull();
        expect(findColorValue(['text-xl'], 'text-')).toBeNull();
        expect(findColorValue(['border-solid'], 'border-')).toBeNull();
    });

    it('scopes matches to the given breakpoint', () => {
        expect(findColorValue(['md:text-blue-600'], 'text-', 'md')).toBe('blue-600');
        expect(findColorValue(['text-blue-600'], 'text-', 'md')).toBeNull();
    });

    it('returns the first color match when multiple are present', () => {
        expect(findColorValue(['text-blue-600', 'text-red-50'], 'text-')).toBe('blue-600');
    });

    it('returns null when nothing matches', () => {
        expect(findColorValue(['p-4'], 'text-')).toBeNull();
    });

    it('skips a same-prefix non-color decoy to find the real color', () => {
        expect(findColorValue(['text-center', 'text-blue-600'], 'text-')).toBe('blue-600');
    });
});
