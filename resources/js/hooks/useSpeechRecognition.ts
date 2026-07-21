import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Minimal, module-local typings for the Web Speech API's SpeechRecognition.
 *
 * These are intentionally NOT declared globally: the API is non-standard and
 * absent from the DOM lib, but a global declaration risks clashing with any
 * future lib version that adds it. Keeping the shapes local to this module
 * sidesteps that entirely while still giving us type safety here.
 */
interface SpeechRecognitionAlternativeLike {
    readonly transcript: string;
}

interface SpeechRecognitionResultLike {
    readonly isFinal: boolean;
    readonly length: number;
    readonly [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
    readonly length: number;
    readonly [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
    readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
    readonly error: string;
}

interface SpeechRecognitionInstance {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
    if (typeof window === 'undefined') {
        return null;
    }
    const w = window as unknown as {
        SpeechRecognition?: SpeechRecognitionCtor;
        webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseSpeechRecognitionOptions {
    /** BCP-47 language tag for recognition (e.g. "en", "fr"). Defaults to the page locale. */
    lang?: string;
}

export interface UseSpeechRecognitionResult {
    /** Whether the browser exposes the Web Speech API at all. */
    isSupported: boolean;
    /** Whether a recognition session is currently active. */
    isListening: boolean;
    /** Cumulative recognized text (final + interim) for the current session. Reset on start(). */
    transcript: string;
    /** The last recognition error code (e.g. "not-allowed", "no-speech"), or null. */
    error: string | null;
    /** Begin a fresh recognition session (clears transcript and error). No-op if unsupported. */
    start: () => void;
    /** End the current recognition session. */
    stop: () => void;
}

/**
 * React hook wrapping the browser-native Web Speech API (SpeechRecognition).
 *
 * No backend, no audio upload — transcription happens entirely in the browser.
 * Returns `isSupported: false` everywhere the API is missing (e.g. Firefox), so
 * callers can simply hide their voice UI rather than render a broken control.
 */
export function useSpeechRecognition(
    options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionResult {
    const { lang } = options;

    // The constructor is stable for the page's lifetime — resolve it once.
    const [isSupported] = useState<boolean>(() => getRecognitionCtor() !== null);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const mountedRef = useRef(true);
    // Keep the latest lang reachable from start() without re-creating the callback.
    const langRef = useRef(lang);
    useEffect(() => {
        langRef.current = lang;
    }, [lang]);

    const teardown = useCallback(() => {
        const recognition = recognitionRef.current;
        if (!recognition) {
            return;
        }
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.onstart = null;
        try {
            recognition.abort();
        } catch {
            // Aborting an already-stopped instance can throw — safe to ignore.
        }
        recognitionRef.current = null;
    }, []);

    const stop = useCallback(() => {
        const recognition = recognitionRef.current;
        if (!recognition) {
            return;
        }
        try {
            recognition.stop();
        } catch {
            // stop() on an instance that never started can throw — ignore.
        }
    }, []);

    const start = useCallback(() => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) {
            return;
        }
        // Drop any prior session before opening a new one.
        teardown();

        const recognition = new Ctor();
        recognition.lang = langRef.current || (typeof document !== 'undefined' ? document.documentElement.lang : '') || 'en';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            if (!mountedRef.current) {
                return;
            }
            // With continuous recognition the results list is cumulative for the
            // session, so concatenating every entry yields the full transcript
            // (final segments plus the in-progress interim tail).
            let text = '';
            for (let i = 0; i < event.results.length; i += 1) {
                text += event.results[i][0].transcript;
            }
            setTranscript(text);
        };

        recognition.onerror = (event) => {
            if (!mountedRef.current) {
                return;
            }
            setError(event.error);
        };

        recognition.onend = () => {
            if (!mountedRef.current) {
                return;
            }
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        setTranscript('');
        setError(null);
        try {
            recognition.start();
            setIsListening(true);
        } catch {
            // start() throws if a session is already running for this instance;
            // we just created it, so this is defensive. Reset state to be safe.
            teardown();
            setIsListening(false);
        }
    }, [teardown]);

    // Tear down any active session when the consumer unmounts.
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            teardown();
        };
    }, [teardown]);

    return { isSupported, isListening, transcript, error, start, stop };
}

export default useSpeechRecognition;
