/**
 * Single source of truth for the v1 user API: drives both the rendered
 * documentation sections and the interactive tester on /api-docs.
 * Keep in sync with routes/api.php and the Api/V1 resources.
 */

export interface ApiParam {
    name: string;
    in: 'path' | 'query';
    type: string;
    required: boolean;
    descriptionKey: string;
    example?: string;
}

export interface ApiEndpoint {
    id: string;
    method: 'GET';
    path: string; // relative to the v1 base url, path params as {name}
    titleKey: string;
    descriptionKey: string;
    params: ApiParam[];
    sampleResponse: unknown;
}

const PAGE_PARAM: ApiParam = {
    name: 'page',
    in: 'query',
    type: 'integer',
    required: false,
    descriptionKey: 'Page number to return.',
    example: '1',
};

const PER_PAGE_PARAM: ApiParam = {
    name: 'per_page',
    in: 'query',
    type: 'integer',
    required: false,
    descriptionKey: 'Results per page (max 50).',
    example: '15',
};

export const API_ENDPOINTS: ApiEndpoint[] = [
    {
        id: 'me',
        method: 'GET',
        path: '/me',
        titleKey: 'Current user',
        descriptionKey: 'Returns the authenticated user profile.',
        params: [],
        sampleResponse: {
            data: {
                id: 1,
                name: 'Ada Lovelace',
                email: 'ada@example.com',
                locale: 'en',
                plan: 'Pro',
                created_at: '2026-01-15T09:30:00+00:00',
            },
        },
    },
    {
        id: 'credits',
        method: 'GET',
        path: '/credits',
        titleKey: 'Build credits',
        descriptionKey: 'Returns your build credit balance and current-period usage.',
        params: [],
        sampleResponse: {
            data: {
                credits_remaining: 87500,
                purchased_credits: 0,
                credits_used: 12500,
                monthly_limit: 100000,
                is_unlimited: false,
                usage_percentage: 12.5,
                using_own_key: false,
                resets_at: '2026-07-01T00:00:00+00:00',
            },
        },
    },
    {
        id: 'subscription',
        method: 'GET',
        path: '/subscription',
        titleKey: 'Subscription',
        descriptionKey: 'Returns your current plan and subscription status.',
        params: [],
        sampleResponse: {
            data: {
                plan: { name: 'Pro', slug: 'pro', price: '19.00', billing_period: 'monthly' },
                subscription: {
                    status: 'active',
                    starts_at: '2026-06-01T00:00:00+00:00',
                    renewal_at: '2026-07-01T00:00:00+00:00',
                    ends_at: null,
                    cancelled_at: null,
                },
            },
        },
    },
    {
        id: 'projects',
        method: 'GET',
        path: '/projects',
        titleKey: 'Projects',
        descriptionKey: 'Returns a paginated list of your projects.',
        params: [PAGE_PARAM, PER_PAGE_PARAM],
        sampleResponse: {
            data: [
                {
                    id: '0d9f7c2e-5b1a-4c3d-8e6f-1a2b3c4d5e6f',
                    name: 'My Bakery Site',
                    description: 'Landing page for a bakery',
                    build_status: 'completed',
                    output_target: 'website',
                    is_public: true,
                    subdomain: 'my-bakery',
                    custom_domain: null,
                    public_url: 'https://my-bakery.example.com',
                    published_at: '2026-06-02T12:00:00+00:00',
                    created_at: '2026-06-01T10:00:00+00:00',
                    updated_at: '2026-06-02T12:00:00+00:00',
                },
            ],
            links: {},
            meta: { current_page: 1, per_page: 15, total: 1 },
        },
    },
    {
        id: 'project-detail',
        method: 'GET',
        path: '/projects/{id}',
        titleKey: 'Project detail',
        descriptionKey: 'Returns a single project you own.',
        params: [
            {
                name: 'id',
                in: 'path',
                type: 'string',
                required: true,
                descriptionKey: 'The project ID (UUID).',
                example: '0d9f7c2e-5b1a-4c3d-8e6f-1a2b3c4d5e6f',
            },
        ],
        sampleResponse: {
            data: {
                id: '0d9f7c2e-5b1a-4c3d-8e6f-1a2b3c4d5e6f',
                name: 'My Bakery Site',
                description: 'Landing page for a bakery',
                build_status: 'completed',
                output_target: 'website',
                is_public: true,
                subdomain: 'my-bakery',
                custom_domain: null,
                public_url: 'https://my-bakery.example.com',
                published_at: '2026-06-02T12:00:00+00:00',
                created_at: '2026-06-01T10:00:00+00:00',
                updated_at: '2026-06-02T12:00:00+00:00',
            },
        },
    },
    {
        id: 'project-files',
        method: 'GET',
        path: '/projects/{id}/files',
        titleKey: 'Project files',
        descriptionKey: 'Returns a paginated list of files uploaded to a project. Requires the file storage capability.',
        params: [
            {
                name: 'id',
                in: 'path',
                type: 'string',
                required: true,
                descriptionKey: 'The project ID (UUID).',
                example: '0d9f7c2e-5b1a-4c3d-8e6f-1a2b3c4d5e6f',
            },
            PAGE_PARAM,
            PER_PAGE_PARAM,
        ],
        sampleResponse: {
            data: [
                {
                    id: 12,
                    name: 'logo.png',
                    size: 20480,
                    mime_type: 'image/png',
                    source: 'dashboard',
                    checksum: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                    url: 'https://my-site.example.com/api/files/0d9f7c2e-5b1a-4c3d-8e6f-1a2b3c4d5e6f/8a1f2c4e-9b7d-4e1a-8c3f-2d6b5a4e1c0f.png',
                    created_at: '2026-06-02T12:00:00+00:00',
                },
            ],
            links: {},
            meta: { current_page: 1, per_page: 20, total: 1 },
        },
    },
    {
        id: 'project-file-detail',
        method: 'GET',
        path: '/projects/{id}/files/{fileId}',
        titleKey: 'Project file detail',
        descriptionKey: 'Returns a single file from a project you own.',
        params: [
            {
                name: 'id',
                in: 'path',
                type: 'string',
                required: true,
                descriptionKey: 'The project ID (UUID).',
                example: '0d9f7c2e-5b1a-4c3d-8e6f-1a2b3c4d5e6f',
            },
            {
                name: 'fileId',
                in: 'path',
                type: 'integer',
                required: true,
                descriptionKey: 'The file ID.',
                example: '12',
            },
        ],
        sampleResponse: {
            data: {
                id: 12,
                name: 'logo.png',
                size: 20480,
                mime_type: 'image/png',
                source: 'dashboard',
                checksum: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
                url: 'https://my-site.example.com/api/files/0d9f7c2e-5b1a-4c3d-8e6f-1a2b3c4d5e6f/8a1f2c4e-9b7d-4e1a-8c3f-2d6b5a4e1c0f.png',
                created_at: '2026-06-02T12:00:00+00:00',
            },
        },
    },
    {
        id: 'notifications',
        method: 'GET',
        path: '/notifications',
        titleKey: 'Notifications',
        descriptionKey: 'Returns a paginated list of your in-app notifications.',
        params: [PAGE_PARAM, PER_PAGE_PARAM],
        sampleResponse: {
            data: [
                {
                    id: 42,
                    type: 'credits_low',
                    title: 'Credits low',
                    message: 'You are nearly out of build credits.',
                    action_url: '/billing',
                    read_at: null,
                    created_at: '2026-06-02T12:00:00+00:00',
                },
            ],
            links: {},
            meta: { current_page: 1, per_page: 20, total: 1 },
        },
    },
    {
        id: 'invoices',
        method: 'GET',
        path: '/invoices',
        titleKey: 'Invoices',
        descriptionKey: 'Returns a paginated list of your completed payment transactions.',
        params: [PAGE_PARAM, PER_PAGE_PARAM],
        sampleResponse: {
            data: [
                {
                    id: 7,
                    invoice_number: '#INV-2026-00007',
                    amount: '19.00',
                    currency: 'USD',
                    status: 'completed',
                    type: 'subscription_new',
                    payment_method: 'paypal',
                    plan: 'Pro',
                    transaction_date: '2026-06-01T00:00:00+00:00',
                },
            ],
            links: {},
            meta: { current_page: 1, per_page: 15, total: 1 },
        },
    },
];

/**
 * Builds the request URL for an endpoint: substitutes {path} params with
 * provided values (placeholders are kept when empty so the user can see what
 * is missing) and appends non-empty query params.
 */
export function buildUrl(
    baseUrl: string,
    endpoint: ApiEndpoint,
    paramValues: Record<string, string>,
): string {
    let path = endpoint.path;
    const query: string[] = [];

    for (const param of endpoint.params) {
        const value = (paramValues[param.name] ?? '').trim();
        if (param.in === 'path') {
            if (value !== '') {
                path = path.replace(`{${param.name}}`, encodeURIComponent(value));
            }
        } else if (value !== '') {
            query.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`);
        }
    }

    return baseUrl + path + (query.length > 0 ? `?${query.join('&')}` : '');
}
