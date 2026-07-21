import { type ApiEndpoint, buildUrl } from './apiCatalog';

export const SNIPPET_LANGS = ['curl', 'javascript', 'php', 'python'] as const;

export type SnippetLang = (typeof SNIPPET_LANGS)[number];

export const SNIPPET_LABELS: Record<SnippetLang, string> = {
    curl: 'curl',
    javascript: 'JavaScript',
    php: 'PHP',
    python: 'Python',
};

/**
 * Pure generator for the per-endpoint code samples on /api-docs. Code output
 * is intentionally NOT localized; only surrounding UI strings are.
 */
export function generateSnippet(
    lang: SnippetLang,
    endpoint: ApiEndpoint,
    baseUrl: string,
    paramValues: Record<string, string>,
    apiKey?: string,
): string {
    const url = buildUrl(baseUrl, endpoint, paramValues);
    const key = apiKey && apiKey.trim() !== '' ? apiKey.trim() : 'YOUR_API_KEY';

    switch (lang) {
        case 'curl':
            return [
                'curl \\',
                `  -H "Authorization: Bearer ${key}" \\`,
                '  -H "Accept: application/json" \\',
                `  "${url}"`,
            ].join('\n');

        case 'javascript':
            return [
                `const response = await fetch('${url}', {`,
                '    headers: {',
                `        Authorization: 'Bearer ${key}',`,
                "        Accept: 'application/json',",
                '    },',
                '});',
                'const data = await response.json();',
                'console.log(data);',
            ].join('\n');

        case 'php':
            return [
                '<?php',
                '',
                `$ch = curl_init('${url}');`,
                'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
                'curl_setopt($ch, CURLOPT_HTTPHEADER, [',
                `    'Authorization: Bearer ${key}',`,
                "    'Accept: application/json',",
                ']);',
                '$data = json_decode(curl_exec($ch), true);',
                'curl_close($ch);',
                '',
                'print_r($data);',
            ].join('\n');

        case 'python':
            return [
                'import requests',
                '',
                'response = requests.get(',
                `    "${url}",`,
                '    headers={',
                `        "Authorization": "Bearer ${key}",`,
                '        "Accept": "application/json",',
                '    },',
                ')',
                'data = response.json()',
                'print(data)',
            ].join('\n');
    }
}
