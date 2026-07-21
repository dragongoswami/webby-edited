import { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { LogOut } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageSelector } from '@/components/LanguageSelector';
import { NotificationBell } from '@/components/Notifications/NotificationBell';
import { GlobalCredits } from '@/components/Header/GlobalCredits';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserChannel } from '@/hooks/useUserChannel';
import { useTranslation } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { User, PageProps } from '@/types';
import type { UserCredits, UserNotification, ProjectStatusEvent } from '@/types/notifications';
import type { BroadcastConfig } from '@/hooks/useBuilderPusher';

interface AppPageHeaderProps {
    user: User;
    /**
     * Style of the sticky header bar.
     * - "translucent" (default): backdrop blur with bg-background/80, border-b
     * - "transparent": no border or background (used on Create page hero)
     */
    variant?: 'translucent' | 'transparent';
    /** Additional onProjectStatus callback for pages that need project status updates. */
    onProjectStatus?: (status: ProjectStatusEvent) => void;
}

export function AppPageHeader({
    user,
    variant = 'translucent',
    onProjectStatus,
}: AppPageHeaderProps) {
    const { t } = useTranslation();

    const { broadcastConfig, userCredits, unreadNotificationCount } = usePage<PageProps & {
        broadcastConfig: BroadcastConfig | null;
        userCredits: UserCredits | null;
        unreadNotificationCount: number;
    }>().props;

    const {
        notifications,
        unreadCount,
        isLoading: isLoadingNotifications,
        addNotification,
        markAsRead,
        markAllAsRead,
    } = useNotifications(unreadNotificationCount);

    const [credits, setCredits] = useState<UserCredits | null>(userCredits);

    useUserChannel({
        userId: user.id,
        broadcastConfig,
        enabled: !!broadcastConfig?.key,
        onNotification: (notification: UserNotification) => {
            addNotification(notification);
            if (notification.type === 'credits_low') {
                toast(notification.title, { description: notification.message });
            }
        },
        onCreditsUpdated: (updated) => {
            setCredits({
                remaining: updated.remaining,
                monthlyLimit: updated.monthlyLimit,
                isUnlimited: updated.isUnlimited,
                usingOwnKey: updated.usingOwnKey,
            });
        },
        onProjectStatus,
    });

    return (
        <header
            className={cn(
                'sticky top-0 z-50 flex h-[60px] items-center justify-between px-4',
                variant === 'translucent' && 'border-b bg-background/80 backdrop-blur-sm',
            )}
        >
            <div className="flex items-center gap-2 min-w-0">
                <div className="shrink-0">
                    <SidebarTrigger />
                </div>
                {credits && <GlobalCredits {...credits} />}
            </div>

            <div className="flex items-center gap-2">
                <div className="shrink-0">
                    <LanguageSelector />
                </div>
                <div className="shrink-0">
                    <NotificationBell
                        notifications={notifications}
                        unreadCount={unreadCount}
                        onMarkAsRead={markAsRead}
                        onMarkAllAsRead={markAllAsRead}
                        isLoading={isLoadingNotifications}
                    />
                </div>
                <div className="shrink-0">
                    <ThemeToggle />
                </div>

                <div className="shrink-0">
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className="flex items-center gap-2 hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        aria-label={t('User menu')}
                    >
                        <div className="text-end hidden sm:block">
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Avatar className="h-8 w-8 cursor-pointer">
                            <AvatarImage src={user.avatar || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                                {user.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <div className="px-2 py-1.5">
                            <p className="text-sm font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/logout" method="post" as="button" className="w-full">
                                <LogOut className="h-4 w-4 me-2" />
                                {t('Log Out')}
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
