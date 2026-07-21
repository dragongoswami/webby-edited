/**
 * Tests for VoiceInputButton — the mic toggle that dictates speech into a field.
 * Uses the real useSpeechRecognition hook against a mocked SpeechRecognition global.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { VoiceInputButton } from '../VoiceInputButton';

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

    emit(transcript: string) {
        this.onresult?.({ results: [{ 0: { transcript }, isFinal: true }] });
    }
}

beforeEach(() => {
    // Clear any SpeechRecognition stub from a prior test so support detection
    // stays order-independent (unstubGlobals only resets between files).
    vi.unstubAllGlobals();
    MockSpeechRecognition.last = null;
});

describe('VoiceInputButton', () => {
    it('renders nothing when speech recognition is unsupported', () => {
        const { container } = render(
            <VoiceInputButton value="" onValueChange={vi.fn()} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders a mic button when supported', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        render(<VoiceInputButton value="" onValueChange={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Speak your prompt' })).toBeInTheDocument();
    });

    it('starts listening on click and reflects the pressed state', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        render(<VoiceInputButton value="" onValueChange={vi.fn()} />);

        const button = screen.getByRole('button');
        fireEvent.click(button);

        expect(MockSpeechRecognition.last?.start).toHaveBeenCalledOnce();
        expect(screen.getByRole('button', { name: 'Listening… tap to stop' })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
    });

    it('appends recognized speech to existing field text', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const onValueChange = vi.fn();
        render(<VoiceInputButton value="hello" onValueChange={onValueChange} />);

        fireEvent.click(screen.getByRole('button'));
        act(() => MockSpeechRecognition.last!.emit('world'));

        expect(onValueChange).toHaveBeenLastCalledWith('hello world');
    });

    it('replaces text with speech when the field was empty', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const onValueChange = vi.fn();
        render(<VoiceInputButton value="" onValueChange={onValueChange} />);

        fireEvent.click(screen.getByRole('button'));
        act(() => MockSpeechRecognition.last!.emit('build me a site'));

        expect(onValueChange).toHaveBeenLastCalledWith('build me a site');
    });

    it('shows the denied state after a permission error', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        render(<VoiceInputButton value="" onValueChange={vi.fn()} />);

        fireEvent.click(screen.getByRole('button'));
        act(() => {
            MockSpeechRecognition.last!.onerror?.({ error: 'not-allowed' });
            MockSpeechRecognition.last!.onend?.();
        });

        // Stays clickable (so the user can retry after granting access) but
        // surfaces the denied label.
        const button = screen.getByRole('button', { name: 'Microphone access denied' });
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
    });

    it('stops listening when disabled is toggled on mid-session', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        const { rerender } = render(<VoiceInputButton value="" onValueChange={vi.fn()} />);

        fireEvent.click(screen.getByRole('button'));
        const inst = MockSpeechRecognition.last!;

        rerender(<VoiceInputButton value="" onValueChange={vi.fn()} disabled />);
        expect(inst.stop).toHaveBeenCalled();
    });

    it('stops listening on a second click', () => {
        vi.stubGlobal('SpeechRecognition', MockSpeechRecognition);
        render(<VoiceInputButton value="" onValueChange={vi.fn()} />);

        const button = screen.getByRole('button');
        fireEvent.click(button);
        fireEvent.click(button);

        expect(MockSpeechRecognition.last?.stop).toHaveBeenCalledOnce();
        expect(button).toHaveAttribute('aria-pressed', 'false');
    });
});
