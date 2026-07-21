import { describe, it, expect } from 'vitest';
import { API_ENDPOINTS, buildUrl } from './apiCatalog';

describe('apiCatalog', () => {
    it('defines all nine v1 endpoints', () => {
        expect(API_ENDPOINTS.map((e) => e.id)).toEqual([
            'me', 'credits', 'subscription', 'projects', 'project-detail',
            'project-files', 'project-file-detail', 'notifications', 'invoices',
        ]);
        for (const endpoint of API_ENDPOINTS) {
            expect(endpoint.method).toBe('GET');
            expect(endpoint.sampleResponse).toBeTruthy();
        }
    });

    it('builds plain urls', () => {
        const me = API_ENDPOINTS.find((e) => e.id === 'me')!;
        expect(buildUrl('https://app.test/api/v1', me, {})).toBe('https://app.test/api/v1/me');
    });

    it('substitutes path params', () => {
        const detail = API_ENDPOINTS.find((e) => e.id === 'project-detail')!;
        expect(buildUrl('https://app.test/api/v1', detail, { id: 'abc-123' }))
            .toBe('https://app.test/api/v1/projects/abc-123');
    });

    it('keeps the placeholder when a path param is empty', () => {
        const detail = API_ENDPOINTS.find((e) => e.id === 'project-detail')!;
        expect(buildUrl('https://app.test/api/v1', detail, {}))
            .toBe('https://app.test/api/v1/projects/{id}');
    });

    it('appends only non-empty query params', () => {
        const projects = API_ENDPOINTS.find((e) => e.id === 'projects')!;
        expect(buildUrl('https://app.test/api/v1', projects, { page: '2', per_page: '' }))
            .toBe('https://app.test/api/v1/projects?page=2');
    });
});
