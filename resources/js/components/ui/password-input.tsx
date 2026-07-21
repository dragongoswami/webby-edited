import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
    /** aria-label for the toggle button while the value is masked. */
    revealLabel: string;
    /** aria-label for the toggle button while the value is revealed. */
    hideLabel: string;
}

/**
 * A password/secret field that defaults to masked and lets the user reveal
 * it with a trailing eye toggle. Wraps the shared `Input`, forwarding every
 * other prop (value/onChange/placeholder/autoComplete/className/etc.) and
 * the ref (so callers can focus the field on validation errors).
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
    { revealLabel, hideLabel, className, ...props },
    ref
) {
    const [revealed, setRevealed] = useState(false);

    return (
        <div className="relative">
            <Input ref={ref} type={revealed ? 'text' : 'password'} className={cn('pe-10', className)} {...props} />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute end-0 top-1/2 h-9 w-9 -translate-y-1/2"
                aria-label={revealed ? hideLabel : revealLabel}
                onClick={() => setRevealed((v) => !v)}
            >
                {revealed ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </Button>
        </div>
    );
});
