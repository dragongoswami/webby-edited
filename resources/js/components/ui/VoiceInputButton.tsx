import { useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/LanguageContext';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface VoiceInputButtonProps {
    /** Current text of the field the mic dictates into. */
    value: string;
    /** Called with the new field text as speech is recognized. */
    onValueChange: (value: string) => void;
    /** Disable the control (e.g. while a build is running). */
    disabled?: boolean;
    /** Extra classes for the button. */
    className?: string;
}

/**
 * A microphone toggle that dictates speech into a text field via the browser's
 * Web Speech API. Recognized words are appended to whatever is already in the
 * field. Renders nothing when the browser lacks speech recognition, so callers
 * can drop it in unconditionally.
 */
export function VoiceInputButton({
    value,
    onValueChange,
    disabled = false,
    className,
}: VoiceInputButtonProps) {
    const { t, locale } = useTranslation();
    const { isSupported, isListening, transcript, error, start, stop } =
        useSpeechRecognition({ lang: locale });

    // The text already present when dictation began — speech is appended to it.
    const baseRef = useRef('');
    // Latest field value, read at start() time without re-subscribing the effect.
    const valueRef = useRef(value);
    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    // Push recognized speech into the field as it streams in.
    useEffect(() => {
        if (!isListening || !transcript) {
            return;
        }
        const base = baseRef.current.replace(/\s+$/, '');
        const spoken = transcript.replace(/^\s+/, '');
        onValueChange(base ? `${base} ${spoken}` : spoken);
    }, [transcript, isListening, onValueChange]);

    // If the field is disabled mid-dictation (e.g. a build starts), stop so
    // speech can't keep mutating a field the user can no longer see as active.
    useEffect(() => {
        if (disabled && isListening) {
            stop();
        }
    }, [disabled, isListening, stop]);

    if (!isSupported) {
        return null;
    }

    const handleToggle = () => {
        if (isListening) {
            stop();
            return;
        }
        baseRef.current = valueRef.current ?? '';
        start();
    };

    const deniedMic =
        error === 'not-allowed' || error === 'service-not-allowed';
    const label = isListening
        ? t('Listening… tap to stop')
        : deniedMic
            ? t('Microphone access denied')
            : t('Speak your prompt');

    return (
        <>
            {/* Announce the recording state out-of-band for screen readers, since
                the button's label change is only read when it has focus. */}
            <span role="status" className="sr-only">
                {isListening ? t('Listening… tap to stop') : ''}
            </span>
            <Button
                type="button"
                size="icon"
                variant="ghost"
                // Kept clickable when denied so the user can retry after granting
                // permission (start() clears the error); MicOff signals the state.
                disabled={disabled}
                onClick={handleToggle}
                title={label}
                aria-label={label}
                aria-pressed={isListening}
                className={cn(
                    'shrink-0',
                    isListening && 'text-primary',
                    deniedMic && 'text-muted-foreground',
                    className,
                )}
            >
                {deniedMic ? (
                    <MicOff className="h-4 w-4" />
                ) : (
                    <Mic className={cn('h-4 w-4', isListening && 'animate-pulse')} />
                )}
            </Button>
        </>
    );
}

export default VoiceInputButton;
