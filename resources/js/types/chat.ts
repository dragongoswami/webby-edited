import { PageProps, User } from '@/types';

export interface AttachedFile {
    id: number;
    filename: string;
    mime_type: string;
    size: number;
    human_size: string;
    is_image: boolean;
    is_video?: boolean;
    url: string;
    preview_url: string | null;
}

export interface ClarificationOption {
    id: string;
    label: string;
    description?: string;
}

export interface ClarificationQuestion {
    question: string;
    options: ClarificationOption[];
    multiSelect?: boolean;
}

export interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'system' | 'activity' | 'clarification';
    content: string;
    timestamp: Date;
    activityType?: string;
    thinkingDuration?: number;
    attachedFiles?: AttachedFile[];
    clarificationQuestion?: ClarificationQuestion;
}

export interface ChatProps extends PageProps {
    user: User;
}
