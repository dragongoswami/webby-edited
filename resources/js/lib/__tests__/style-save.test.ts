import { describe, it, expect } from 'vitest';
import {
    determineSaveStrategy,
    formatStyleEditMessage,
    buildMechanicalEdit,
} from '../style-save';

// ---------------------------------------------------------------------------
// A. determineSaveStrategy
// ---------------------------------------------------------------------------
describe('determineSaveStrategy', () => {
    describe('returns "mechanical" when fileContent contains classes in a quoted attribute', () => {
        it('matches className="..." (double quotes)', () => {
            const fileContent = '<div className="text-red-500 font-bold">Hello</div>';
            expect(determineSaveStrategy(fileContent, 'text-red-500 font-bold')).toBe('mechanical');
        });

        it("matches className='...' (single quotes)", () => {
            const fileContent = "<div className='text-red-500 font-bold'>Hello</div>";
            expect(determineSaveStrategy(fileContent, 'text-red-500 font-bold')).toBe('mechanical');
        });

        it('matches class="..." (double quotes)', () => {
            const fileContent = '<div class="text-red-500 font-bold">Hello</div>';
            expect(determineSaveStrategy(fileContent, 'text-red-500 font-bold')).toBe('mechanical');
        });

        it("matches class='...' (single quotes)", () => {
            const fileContent = "<div class='text-red-500 font-bold'>Hello</div>";
            expect(determineSaveStrategy(fileContent, 'text-red-500 font-bold')).toBe('mechanical');
        });
    });

    it('returns "ai" when classes appear as a bare substring but not in a quoted attribute pattern', () => {
        // The class string is a raw substring of fileContent, but not wrapped in
        // className="..." / className='...' / class="..." / class='...'.
        const fileContent = 'text-red-500 font-bold is used here';
        expect(determineSaveStrategy(fileContent, 'text-red-500 font-bold')).toBe('ai');
    });

    it('returns "ai" when originalClassStr is absent from fileContent entirely', () => {
        const fileContent = '<div className="totally-different">Hello</div>';
        expect(determineSaveStrategy(fileContent, 'text-red-500 font-bold')).toBe('ai');
    });

    it('returns "mechanical" on first-match when multiple attribute patterns are present', () => {
        // Both className="foo" (pattern 0) and class="foo" (pattern 2) appear;
        // the loop short-circuits at the first match.
        const fileContent = '<div className="foo" class="foo"></div>';
        expect(determineSaveStrategy(fileContent, 'foo')).toBe('mechanical');
    });

    describe('edge: empty originalClassStr', () => {
        // With originalClassStr = '', the patterns become className="" / className='' /
        // class="" / class=''. The function behaves exactly as for any other string.

        it('returns "mechanical" when fileContent contains className="" (empty double-quoted)', () => {
            const fileContent = '<div className="">Content</div>';
            expect(determineSaveStrategy(fileContent, '')).toBe('mechanical');
        });

        it('returns "ai" when fileContent does not contain any of the empty quoted attribute patterns', () => {
            // class="some-class" is present, but not class="" or className="", etc.
            const fileContent = '<div class="some-class">Content</div>';
            expect(determineSaveStrategy(fileContent, '')).toBe('ai');
        });
    });
});

// ---------------------------------------------------------------------------
// B. formatStyleEditMessage
// ---------------------------------------------------------------------------
describe('formatStyleEditMessage', () => {
    it('produces the full message with Remove + Add + Final lines when both changed', () => {
        const result = formatStyleEditMessage(
            'button',
            ['text-red-500', 'font-bold'],
            ['text-blue-500', 'font-bold', 'italic'],
        );
        const expected = [
            '[STYLE_EDIT] Update element classes:',
            'Element: button',
            'Remove: text-red-500',
            'Add: text-blue-500 italic',
            'Final classes: text-blue-500 font-bold italic',
        ].join('\n');
        expect(result).toBe(expected);
    });

    it('line order: header[0] Element[1] Remove[2] Add[3] Final[4] for both-changed case', () => {
        const lines = formatStyleEditMessage(
            'button',
            ['text-red-500', 'font-bold'],
            ['text-blue-500', 'font-bold', 'italic'],
        ).split('\n');
        expect(lines[0]).toBe('[STYLE_EDIT] Update element classes:');
        expect(lines[1]).toBe('Element: button');
        expect(lines[2]).toBe('Remove: text-red-500');
        expect(lines[3]).toBe('Add: text-blue-500 italic');
        expect(lines[4]).toBe('Final classes: text-blue-500 font-bold italic');
    });

    it('omits Remove line and includes Add line when only additions are present', () => {
        const result = formatStyleEditMessage(
            'span#logo',
            ['text-red-500'],
            ['text-red-500', 'font-bold'],
        );
        expect(result).not.toContain('Remove:');
        expect(result).toContain('Add: font-bold');
        expect(result).toContain('Final classes: text-red-500 font-bold');
    });

    it('includes Remove line and omits Add line when only removals are present', () => {
        const result = formatStyleEditMessage(
            'heading',
            ['text-red-500', 'font-bold'],
            ['text-red-500'],
        );
        expect(result).toContain('Remove: font-bold');
        expect(result).not.toContain('Add:');
        expect(result).toContain('Final classes: text-red-500');
    });

    it('omits both Remove and Add lines when old and new classes are identical', () => {
        const result = formatStyleEditMessage(
            'button',
            ['text-red-500', 'font-bold'],
            ['text-red-500', 'font-bold'],
        );
        const expected = [
            '[STYLE_EDIT] Update element classes:',
            'Element: button',
            'Final classes: text-red-500 font-bold',
        ].join('\n');
        expect(result).toBe(expected);
        expect(result).not.toContain('Remove:');
        expect(result).not.toContain('Add:');
    });

    it('produces a Remove line with all old classes and an empty Final when newClasses is empty', () => {
        const result = formatStyleEditMessage('p', ['text-lg', 'text-gray-500'], []);
        // Final classes: is the template string with an empty join — no trailing space
        // beyond the literal space after the colon.
        const expected = [
            '[STYLE_EDIT] Update element classes:',
            'Element: p',
            'Remove: text-lg text-gray-500',
            'Final classes: ',
        ].join('\n');
        expect(result).toBe(expected);
    });

    it('interpolates elementDescription verbatim into the Element line', () => {
        const desc = 'div#hero-section > h1.text-4xl[data-component="x"]';
        const result = formatStyleEditMessage(desc, [], ['text-xl']);
        expect(result).toContain(`Element: ${desc}`);
    });
});

// ---------------------------------------------------------------------------
// C. buildMechanicalEdit
// ---------------------------------------------------------------------------
describe('buildMechanicalEdit', () => {
    it('returns exact search and replace strings for a single class', () => {
        expect(buildMechanicalEdit('text-red-500', 'text-blue-500')).toEqual({
            search: 'className="text-red-500"',
            replace: 'className="text-blue-500"',
        });
    });

    it('returns exact search and replace strings for multiple space-separated classes', () => {
        expect(
            buildMechanicalEdit('text-red-500 font-bold', 'text-blue-500 font-bold italic'),
        ).toEqual({
            search: 'className="text-red-500 font-bold"',
            replace: 'className="text-blue-500 font-bold italic"',
        });
    });
});
