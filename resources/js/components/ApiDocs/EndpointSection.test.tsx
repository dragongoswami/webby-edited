import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { API_ENDPOINTS } from '@/lib/apiCatalog';
import { EndpointSection } from './EndpointSection';

const projectDetail = API_ENDPOINTS.find((e) => e.id === 'project-detail')!;

describe('EndpointSection — param lifting', () => {
    it('reflects typed tester params in the code-sample snippet', () => {
        render(
            <EndpointSection
                endpoint={projectDetail}
                baseUrl="https://app.test/api/v1"
                apiKey=""
            />,
        );

        fireEvent.change(screen.getByLabelText('id'), { target: { value: 'p-42' } });

        // The curl tab is the default; its <code> block must reflect the typed id.
        expect(screen.getAllByText(/projects\/p-42/).length).toBeGreaterThan(0);
    });
});
