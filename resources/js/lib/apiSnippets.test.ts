import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS } from './apiCatalog';
import { generateSnippet, SNIPPET_LANGS } from './apiSnippets';

const me = API_ENDPOINTS.find((e) => e.id === 'me')!;

describe('apiSnippets', () => {
    it('generates a snippet for every language', () => {
        for (const lang of SNIPPET_LANGS) {
            const snippet = generateSnippet(lang, me, 'https://app.test/api/v1', {});
            expect(snippet).toContain('https://app.test/api/v1/me');
            expect(snippet).toContain('YOUR_API_KEY');
        }
    });

    it('uses the provided api key when given', () => {
        const snippet = generateSnippet('curl', me, 'https://app.test/api/v1', {}, 'sk_live');
        expect(snippet).toContain('Bearer sk_live');
        expect(snippet).not.toContain('YOUR_API_KEY');
    });

    it('produces language-specific markers', () => {
        expect(generateSnippet('curl', me, 'https://x.test/api/v1', {})).toContain('curl');
        expect(generateSnippet('javascript', me, 'https://x.test/api/v1', {})).toContain('fetch(');
        expect(generateSnippet('php', me, 'https://x.test/api/v1', {})).toContain('curl_init');
        expect(generateSnippet('python', me, 'https://x.test/api/v1', {})).toContain('import requests');
    });

    it('substitutes typed params into the url', () => {
        const detail = API_ENDPOINTS.find((e) => e.id === 'project-detail')!;
        const snippet = generateSnippet('curl', detail, 'https://x.test/api/v1', { id: 'p-1' });
        expect(snippet).toContain('/projects/p-1');
    });
});
