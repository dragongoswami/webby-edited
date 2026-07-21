import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CodeBlock } from './CodeBlock';
import type { CodeLanguage } from './CodeBlock';

describe('CodeBlock', () => {
    it('renders highlighted token spans', () => {
        const { container } = render(
            <CodeBlock code={'const data = await response.json();'} language="javascript" />,
        );
        expect(container.querySelectorAll('.token').length).toBeGreaterThan(0);
        expect(container.textContent).toContain('const data');
    });

    it('escapes embedded html instead of rendering it', () => {
        const { container } = render(
            <CodeBlock code={'{"xss": "<script>alert(1)</script>"}'} language="json" />,
        );
        expect(container.querySelector('script')).toBeNull();
        expect(container.textContent).toContain('<script>alert(1)</script>');
    });

    it('falls back to plain text for unknown grammars', () => {
        const { container } = render(<CodeBlock code={'plain text'} language="bash" />);
        expect(container.textContent).toBe('plain text');
    });

    it('renders a plain code element when the grammar is not registered', () => {
        const { container } = render(<CodeBlock code={'SELECT 1'} language={'sql' as CodeLanguage} />);
        expect(container.querySelector('code')?.innerHTML).toBe('SELECT 1');
        expect(container.querySelectorAll('.token').length).toBe(0);
    });
});
