import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ICON_NAMES, getIconComponent } from '@/components/Landing/data';

interface IconPickerProps {
    value: string;
    onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
    return (
        <Select value={value || undefined} onValueChange={onChange}>
            <SelectTrigger>
                <SelectValue placeholder="Sparkles" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
                {ICON_NAMES.map((name) => {
                    const Icon = getIconComponent(name);
                    return (
                        <SelectItem key={name} value={name}>
                            <span className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                {name}
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}
