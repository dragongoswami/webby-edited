import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeBuilderError } from '../builderErrors';

// Identity translator: returns the key verbatim, so the returned value IS the
// raw message string defined in builderErrors.ts. This lets us pin the exact
// pattern -> message mapping (each message doubles as the chat.json i18n key).
const identity = (key: string) => key;

const RATE = 'The AI service is currently rate limited. Please wait a moment and try again.';
const AUTH = 'There was an authentication issue with the AI service. Please contact support if this persists.';
const MODEL = 'The AI model is not available. Please contact support.';
const CONTEXT = 'The conversation has become too long for the AI to process. Try starting a new conversation.';
const FILTER = 'Your request was flagged by the content filter. Please rephrase your message and try again.';
const CONNECTION = 'Lost connection to the AI service. Please try again.';
const TIMEOUT = 'The AI service took too long to respond. Please try again.';
const SERVER = 'The AI service is temporarily unavailable. Please try again in a few moments.';
const OVERLOAD = 'The AI service is experiencing high demand. Please try again shortly.';
const BAD_REQUEST = 'The request could not be processed. Please try again.';
const CREDITS = "You've run out of build credits. Please upgrade your plan or wait for your credits to reset.";
const NO_BUILDERS = 'No build servers are currently available. Please try again later.';
const FALLBACK = 'Something went wrong. Please try again.';

describe('sanitizeBuilderError', () => {
    beforeEach(() => {
        // Silence (and observe) the debug logging the function always emits.
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('pattern → message mapping', () => {
        const cases: Array<[string, string, string]> = [
            ['rate limit (429)', 'anthropic error: 429 rate limit', RATE],
            ['rate limit (phrase)', 'too many requests', RATE],
            ['auth (401)', 'openai error: 401 unauthorized', AUTH],
            ['auth (invalid api key)', 'invalid_api_key', AUTH],
            ['model not found', 'model not found', MODEL],
            ['context length', 'maximum context length exceeded', CONTEXT],
            ['content filter', 'request flagged by safety', FILTER],
            ['connection', 'connection refused', CONNECTION],
            ['timeout', 'request timed out', TIMEOUT],
            ['server error (500)', 'internal server error', SERVER],
            ['overloaded', 'the model is overloaded', OVERLOAD],
            ['bad request (400)', '400 bad request', BAD_REQUEST],
            ['credits exhausted', 'Build credits exhausted', CREDITS],
            ['no credits', 'no credits remaining', CREDITS],
            ['no builders', 'no builders available', NO_BUILDERS],
        ];

        it.each(cases)('maps %s', (_label, raw, expected) => {
            expect(sanitizeBuilderError(raw, identity)).toBe(expected);
        });
    });

    it('falls back for an unrecognized error', () => {
        expect(sanitizeBuilderError('totally unknown gremlin', identity)).toBe(FALLBACK);
    });

    describe('order sensitivity (first matching pattern wins)', () => {
        it('prefers auth over timeout when both appear', () => {
            // "401" matches AUTH (earlier) before "timed out" matches TIMEOUT.
            expect(sanitizeBuilderError('401 unauthorized: request timed out', identity)).toBe(AUTH);
        });

        it('classifies "gateway timeout" as a timeout, not a server error', () => {
            // The timeout pattern precedes the 500-504 server-error pattern, and
            // "gateway timeout" contains "timeout" — guards against a reorder regression.
            expect(sanitizeBuilderError('gateway timeout', identity)).toBe(TIMEOUT);
        });
    });

    describe('defensive guard for non-string input', () => {
        it('returns the fallback for null/undefined without throwing', () => {
            // WebSocket payloads are untyped at runtime.
            expect(sanitizeBuilderError(null as unknown as string, identity)).toBe(FALLBACK);
            expect(sanitizeBuilderError(undefined as unknown as string, identity)).toBe(FALLBACK);
        });

        it('stringifies a numeric code, so a numeric 429 still classifies as rate limit', () => {
            expect(sanitizeBuilderError(429 as unknown as string, identity)).toBe(RATE);
        });

        it('returns the fallback for an object', () => {
            expect(sanitizeBuilderError({} as unknown as string, identity)).toBe(FALLBACK);
        });
    });

    it('passes the resolved message through the translator', () => {
        const t = vi.fn((key: string) => `translated:${key}`);
        expect(sanitizeBuilderError('429 rate limit', t)).toBe(`translated:${RATE}`);
        expect(t).toHaveBeenCalledWith(RATE);
    });

    it('logs the raw error for debugging', () => {
        sanitizeBuilderError('some raw builder error', identity);
        expect(console.error).toHaveBeenCalledWith('[Builder Error]', 'some raw builder error');
    });
});
