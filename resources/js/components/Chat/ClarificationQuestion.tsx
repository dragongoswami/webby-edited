import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/LanguageContext';
import type { ClarificationOption, ClarificationQuestion as ClarificationQuestionType } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ClarificationQuestionProps {
    question: ClarificationQuestionType;
    onSelect: (option: ClarificationOption) => void;
    onSkip?: () => void;
    className?: string;
}

export function ClarificationQuestion({
    question,
    onSelect,
    onSkip,
    className,
}: ClarificationQuestionProps) {
    const { t } = useTranslation();

    return (
        <div className={cn('space-y-3 p-4 bg-muted/50 rounded-lg border border-border', className)}>
            <p className="text-sm font-medium text-foreground">{question.question}</p>

            <div className="flex flex-wrap gap-2">
                {question.options.map((option) => (
                    <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelect(option)}
                        className={cn(
                            'h-auto py-2 px-3 text-left justify-start',
                            'hover:bg-primary hover:text-primary-foreground hover:border-primary',
                            'transition-colors'
                        )}
                    >
                        <span className="font-medium">{option.label}</span>
                        {option.description && (
                            <span className="block text-xs opacity-70 mt-0.5">{option.description}</span>
                        )}
                    </Button>
                ))}
            </div>

            {onSkip && (
                <button
                    type="button"
                    onClick={onSkip}
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                    {t('Skip and continue with default')}
                </button>
            )}
        </div>
    );
}