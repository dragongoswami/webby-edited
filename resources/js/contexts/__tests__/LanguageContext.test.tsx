/**
 * Tests for the `translate` helper behind LanguageContext's t() function.
 * Covers simple :placeholder replacement and pipe-based pluralization.
 *
 * We test the pure helper directly so the global LanguageContext mock in
 * resources/js/test/setup.ts doesn't short-circuit the real logic.
 */
import { describe, it, expect, vi } from 'vitest';

// Un-mock the module for this file so the real `translate` is exported.
vi.unmock('@/contexts/LanguageContext');

import { translate } from '../LanguageContext';

describe('translate', () => {
    it('returns the key itself when no translation exists', () => {
        expect(translate({}, 'Missing key')).toBe('Missing key');
    });

    it('applies :placeholder replacements', () => {
        expect(translate({ 'Hello :name': 'Hello :name' }, 'Hello :name', { name: 'World' })).toBe(
            'Hello World'
        );
    });

    it('picks the singular form when count === 1', () => {
        const tr = { ':count files': '1 file|:count files' };
        expect(translate(tr, ':count files', { count: 1 })).toBe('1 file');
    });

    it('picks the plural form for count !== 1', () => {
        const tr = { ':count files': '1 file|:count files' };
        expect(translate(tr, ':count files', { count: 0 })).toBe('0 files');
        expect(translate(tr, ':count files', { count: 5 })).toBe('5 files');
        expect(translate(tr, ':count files', { count: 47 })).toBe('47 files');
    });

    it('picks the last form when locale provides more than two plural categories', () => {
        // ru-style "one|few|many" — we pick the last form for count !== 1.
        const tr = { ':count files': '1 файл|:count файла|:count файлов' };
        expect(translate(tr, ':count files', { count: 1 })).toBe('1 файл');
        expect(translate(tr, ':count files', { count: 10 })).toBe('10 файлов');
    });

    it('does not pluralize when the translation contains no pipe', () => {
        const tr = { 'Just :count': 'Just :count' };
        expect(translate(tr, 'Just :count', { count: 1 })).toBe('Just 1');
        expect(translate(tr, 'Just :count', { count: 5 })).toBe('Just 5');
    });

    it('does not pluralize when no count replacement is provided', () => {
        const tr = { 'a|b': 'a|b' };
        // No count → the literal "a|b" comes back untouched (no plural split).
        expect(translate(tr, 'a|b')).toBe('a|b');
    });

    it('handles an undefined translations map', () => {
        expect(translate(undefined, 'Some key')).toBe('Some key');
        expect(translate(undefined, 'With :x', { x: 'y' })).toBe('With y');
    });

    it('replaces every occurrence of a repeated placeholder', () => {
        const tr = { 'Hi :name, bye :name': 'Hi :name, bye :name' };
        expect(translate(tr, 'Hi :name, bye :name', { name: 'Ada' })).toBe('Hi Ada, bye Ada');
    });

    it('does not let a short placeholder clobber a longer one sharing its prefix', () => {
        const tr = { ':count of :countTotal': ':count of :countTotal' };
        expect(translate(tr, ':count of :countTotal', { count: 3, countTotal: 10 })).toBe('3 of 10');
        // Order-independent: the longer key must survive regardless of insertion order.
        expect(translate(tr, ':count of :countTotal', { countTotal: 10, count: 3 })).toBe('3 of 10');
    });

    it('only substitutes whole placeholder tokens', () => {
        const tr = { ':id and :identifier': ':id and :identifier' };
        expect(translate(tr, ':id and :identifier', { id: 7, identifier: 'abc' })).toBe('7 and abc');
    });

    // Coverage for the new event-bubble keys added for synthetic user
    // messages. These are the first keys that combine a non-`count`
    // placeholder (`:name`, `:selector`) with other interpolations, plus
    // the batch-edit pipe-plural which embeds `:count` inside the plural
    // form.
    describe('synthetic-event i18n keys', () => {
        const tr = {
            'Applying :name theme': 'Applying :name theme',
            'Updated styles on :selector': 'Updated styles on :selector',
            'AI edit on :selector': 'AI edit on :selector',
            'Saved :count pending changes':
                '1 pending change saved|Saved :count pending changes',
        };

        it('interpolates :name in the theme-apply title', () => {
            expect(translate(tr, 'Applying :name theme', { name: 'Mocha' })).toBe(
                'Applying Mocha theme'
            );
        });

        it('interpolates :selector in the style-edit and AI-edit titles', () => {
            expect(
                translate(tr, 'Updated styles on :selector', { selector: '<h1.text-5xl>' })
            ).toBe('Updated styles on <h1.text-5xl>');
            expect(
                translate(tr, 'AI edit on :selector', { selector: '<p.lead>' })
            ).toBe('AI edit on <p.lead>');
        });

        it('picks the singular batch-edit form when count === 1', () => {
            expect(
                translate(tr, 'Saved :count pending changes', { count: 1 })
            ).toBe('1 pending change saved');
        });

        it('picks the plural batch-edit form and interpolates count when != 1', () => {
            expect(
                translate(tr, 'Saved :count pending changes', { count: 3 })
            ).toBe('Saved 3 pending changes');
            expect(
                translate(tr, 'Saved :count pending changes', { count: 0 })
            ).toBe('Saved 0 pending changes');
        });
    });
});
