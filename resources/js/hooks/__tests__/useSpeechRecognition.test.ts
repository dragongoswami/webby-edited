/**
 * Tests for useSpeechRecognition — the Web Speech API wrapper hook.
 * SpeechRecognition is absent from jsdom, so we stub a minimal mock global.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from '../useSpeechRecognition';

interface ResultPart {
    transcript: string;
    isFinal: boolean;
}

class MockSpeechRecognition {
    static last: MockSpeechRecognition | null = null;

    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 0;
    onresult: ((e: { results: Array<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    onstart: (() => void) | null = null;

    start = vi.fn();
    stop = vi.fn(() => this.onend?.());
    abort = vi.fn();

    constructor() {
        MockSpeechRecognition.last = this;
    }

    /** Emit a cumulative results list, mirroring the browser's continuous mode. */
    emit(parts: ResultPart[]) {
        const results = parts.map((p) => ({ 0: { transcript: p.transcript }, isFinal: p.isFinal }));
        this.onresult?.({ results });
    }
}

beforeEach(() => {
    // Clear any SpeechRecognition stub from a prior test so each test's support
    // detection is order-independent.
    vi.unstubAllGlobals();
    MockSpeechRecognition.last = null;
});

describe('useSpeechRecognition', () => {
    it('reports unsupported when the API is missing', () => {
        // beforeEach clears any stub, so the API is genuinely absent here.
        const { result } = renderHook(() => useSpeechRecognition());
        expect(result.current.isSupported).toBe(false);
        // start() is a safe no-op when unsupported.
        act(() => result.current.start());
        expect(result.current.isListening).toBe(false);
    });

    it('reports supported and configures recognition on start', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const { result } = renderHook(() => useSpeechRecognition({ lang: 'fr' }));

        expect(result.current.isSupported).toBe(true);

        act(() => result.current.start());

        const inst = MockSpeechRecognition.last!;
        expect(inst).toBeTruthy();
        expect(inst.continuous).toBe(true);
        expect(inst.interimResults).toBe(true);
        expect(inst.lang).toBe('fr');
        expect(inst.start).toHaveBeenCalledOnce();
        expect(result.current.isListening).toBe(true);
    });

    it('accumulates the cumulative transcript from result events', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        act(() =>
            MockSpeechRecognition.last!.emit([
                { transcript: 'build a ', isFinal: true },
                { transcript: 'portfolio site', isFinal: false },
            ]),
        );

        expect(result.current.transcript).toBe('build a portfolio site');
    });

    it('falls back to webkit-prefixed constructor', () => {
        vi.stubGlobal('webkitSpeechRecognition', MockSpeechRecognition);
        const { result } = renderHook(() => useSpeechRecognition());
        expect(result.current.isSupported).toBe(true);
    });

    it('stops listening when the session ends', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        expect(result.current.isListening).toBe(true);

        act(() => result.current.stop());
        expect(result.current.isListening).toBe(false);
    });

    it('captures recognition errors', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        act(() => MockSpeechRecognition.last!.onerror?.({ error: 'not-allowed' }));

        expect(result.current.error).toBe('not-allowed');
    });

    it('resets transcript and error on a fresh start', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const { result } = renderHook(() => useSpeechRecognition());

        act(() => result.current.start());
        act(() => MockSpeechRecognition.last!.emit([{ transcript: 'hello', isFinal: true }]));
        expect(result.current.transcript).toBe('hello');

        act(() => result.current.start());
        expect(result.current.transcript).toBe('');
        expect(result.current.error).toBeNull();
    });
});
