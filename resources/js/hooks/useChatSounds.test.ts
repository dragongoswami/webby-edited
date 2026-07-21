import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useChatSounds, type SoundSettings } from './useChatSounds';

// Minimal Web Audio stub that counts how many oscillators (voices) get created,
// so we can assert how many times a sound generator actually ran.
function installAudioStub() {
    let oscCount = 0;
    class FakeParam {
        setValueAtTime() {}
        exponentialRampToValueAtTime() {}
        linearRampToValueAtTime() {}
    }
    class FakeNode {
        connect() {}
    }
    class FakeOsc extends FakeNode {
        type = '';
        frequency = new FakeParam();
        start() {}
        stop() {}
    }
    class FakeGain extends FakeNode {
        gain = new FakeParam();
    }
    class FakeFilter extends FakeNode {
        type = '';
        frequency = new FakeParam();
        Q = new FakeParam();
    }
    class FakeCtx {
        state = 'running';
        currentTime = 0;
        destination = {};
        createOscillator() {
            oscCount++;
            return new FakeOsc();
        }
        createGain() {
            return new FakeGain();
        }
        createBiquadFilter() {
            return new FakeFilter();
        }
        resume() {
            return Promise.resolve();
        }
        close() {
            return Promise.resolve();
        }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
    return { getCount: () => oscCount };
}

const SETTINGS: SoundSettings = { enabled: true, style: 'minimal', volume: 50 };

describe('useChatSounds — playSound de-dup', () => {
    let now = 1000;
    let nowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        now = 1000;
        nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
    });
    afterEach(() => {
        nowSpy.mockRestore();
    });

    it('collapses two identical sounds fired in the same instant into one play', () => {
        const audio = installAudioStub();
        const { result } = renderHook(() => useChatSounds({ settings: SETTINGS }));

        result.current.playSound('build'); // one 'build' play = a burst of oscillators
        const afterFirst = audio.getCount();
        expect(afterFirst).toBeGreaterThan(0);

        result.current.playSound('build'); // same instant → de-duped → no new voices
        expect(audio.getCount()).toBe(afterFirst);
    });

    it('plays again once the de-dup window has passed', () => {
        const audio = installAudioStub();
        const { result } = renderHook(() => useChatSounds({ settings: SETTINGS }));

        result.current.playSound('build');
        const afterFirst = audio.getCount();

        now += 500; // well past the de-dup window
        result.current.playSound('build');
        expect(audio.getCount()).toBeGreaterThan(afterFirst);
    });

    it('plays again exactly at the window boundary (strict less-than)', () => {
        const audio = installAudioStub();
        const { result } = renderHook(() => useChatSounds({ settings: SETTINGS }));

        result.current.playSound('build');
        const afterFirst = audio.getCount();

        now += 100; // exactly SOUND_DEDUP_MS — the `<` check means this should play
        result.current.playSound('build');
        expect(audio.getCount()).toBeGreaterThan(afterFirst);
    });

    it('never de-dups across distinct events', () => {
        const audio = installAudioStub();
        const { result } = renderHook(() => useChatSounds({ settings: SETTINGS }));

        result.current.playSound('build');
        const afterBuild = audio.getCount();
        result.current.playSound('message'); // different event, same instant → still plays
        expect(audio.getCount()).toBeGreaterThan(afterBuild);
    });
});
