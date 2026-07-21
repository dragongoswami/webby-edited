import { Smartphone, Tablet, Monitor } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type PreviewDevice = 'phone' | 'tablet' | 'full';

/** Widths (px) for the constrained device modes; 'full' renders with no constraint. */
export const DEVICE_WIDTHS: Record<Exclude<PreviewDevice, 'full'>, number> = {
    phone: 375,
    tablet: 768,
};

interface DeviceWidthToggleProps {
    value: PreviewDevice;
    onChange: (device: PreviewDevice) => void;
}

/**
 * Segmented control letting the editor preview constrain the iframe to a
 * phone/tablet width, or view it at full width. Hidden below `md` — on
 * phones the preview is already phone-width, so the control isn't useful.
 */
export function DeviceWidthToggle({ value, onChange }: DeviceWidthToggleProps) {
    const { t } = useTranslation();

    const options: { device: PreviewDevice; icon: typeof Smartphone; label: string }[] = [
        { device: 'phone', icon: Smartphone, label: t('Phone preview') },
        { device: 'tablet', icon: Tablet, label: t('Tablet preview') },
        { device: 'full', icon: Monitor, label: t('Full width preview') },
    ];

    return (
        <div className="hidden md:flex items-center gap-1">
            {options.map(({ device, icon: Icon, label }) => (
                <button
                    key={device}
                    type="button"
                    aria-pressed={value === device}
                    aria-label={label}
                    onClick={() => onChange(device)}
                    className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                        value === device
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-transparent text-muted-foreground hover:bg-muted'
                    )}
                >
                    <Icon className="h-4 w-4" aria-hidden />
                </button>
            ))}
        </div>
    );
}

export default DeviceWidthToggle;
