import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';

export function ThemeToggle() {
    const { theme, resolvedTheme, setTheme } = useTheme();
    const { t } = useTranslation();

    const cycleTheme = () => {
        if (theme === 'light') {
            setTheme('dark');
        } else if (theme === 'dark') {
            setTheme('system');
        } else {
            setTheme('light');
        }
    };

    const getAriaLabel = () => {
        if (theme === 'system') {
            return t('Switch to light mode (currently using system preference)');
        }
        if (resolvedTheme === 'dark') {
            return t('Switch to light mode');
        }
        return t('Switch to dark mode');
    };

    const getIcon = () => {
        if (theme === 'system') {
            return <Monitor className="h-4 w-4" />;
        }
        if (resolvedTheme === 'dark') {
            return <Sun className="h-4 w-4" />;
        }
        return <Moon className="h-4 w-4" />;
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label={getAriaLabel()}
        >
            {getIcon()}
        </Button>
    );
}
