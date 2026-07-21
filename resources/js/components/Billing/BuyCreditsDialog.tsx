import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, Star, Loader2, CreditCard, Building2, Clock, Copy, Gift } from 'lucide-react';
import type { CreditPack, CreditPackGateway } from '@/types/billing';
import type { PageProps } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { formatCurrency as formatCurrencyUtil } from '@/lib/currency';
import { toast } from 'sonner';

interface CreditPackBankTransferData {
    type: string;
    reference: string;
    amount: number;
    currency: string;
    pack_name: string;
    instructions: string;
}

interface BuyCreditsDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    packs: CreditPack[];
    gateways: CreditPackGateway[];
}

export default function BuyCreditsDialog({
    open,
    onOpenChange,
    packs,
    gateways,
}: BuyCreditsDialogProps) {
    const { flash } = usePage<PageProps & { flash: { bankTransfer?: CreditPackBankTransferData } }>().props;
    const { t, locale } = useTranslation();
    const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
    const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [bankTransferData, setBankTransferData] = useState<CreditPackBankTransferData | null>(null);
    const [copied, setCopied] = useState(false);

    // Switch to instructions view when bank transfer flash data arrives
    useEffect(() => {
        if (flash?.bankTransfer?.type === 'bank_transfer' && flash.bankTransfer.pack_name) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing flash data to local state on page load
            setBankTransferData(flash.bankTransfer);
            setIsProcessing(false);
        }
    }, [flash?.bankTransfer]);

    const formatCurrency = (amount: number, currency: string) => {
        return formatCurrencyUtil(amount, currency, locale);
    };

    const copyInstructions = async () => {
        if (!bankTransferData?.instructions) return;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(bankTransferData.instructions);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = bankTransferData.instructions;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleClose = () => {
        setBankTransferData(null);
        setSelectedPackId(null);
        setSelectedGateway(null);
        setIsProcessing(false);
        onOpenChange(false);
    };

    const handleBuy = () => {
        if (!selectedPackId || !selectedGateway) return;

        setIsProcessing(true);
        router.post(
            route('credit-packs.purchase'),
            { credit_pack_id: selectedPackId, gateway: selectedGateway },
            {
                preserveScroll: true,
                preserveState: true,
                onError: (errors) => {
                    setIsProcessing(false);
                    const m = Object.values(errors)[0] as string;
                    if (m) toast.error(m);
                },
                onFinish: () => setIsProcessing(false),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
            <DialogContent className="sm:max-w-lg">
                {bankTransferData ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                {t('Bank Transfer Instructions')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('Complete your payment using the details below')}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 w-full">
                            {/* Payment Summary */}
                            <div className="p-4 bg-muted rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-muted-foreground">{t('Credit Pack')}</p>
                                        <p className="font-semibold truncate">{bankTransferData.pack_name}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-sm text-muted-foreground">{t('Amount')}</p>
                                        <p className="text-xl font-bold">
                                            {formatCurrency(Number(bankTransferData.amount), bankTransferData.currency)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Reference Number */}
                            <div className="p-4 bg-muted border border-border rounded-lg overflow-hidden">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-sm text-muted-foreground">{t('Payment Reference')}</p>
                                        <p className="font-mono font-bold text-primary truncate">{bankTransferData.reference}</p>
                                    </div>
                                    <Badge variant="outline" className="flex-shrink-0 border-warning text-warning gap-1">
                                        <Clock className="h-3 w-3" />
                                        {t('Pending')}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {t('Include this reference in your transfer')}
                                </p>
                            </div>

                            {/* Bank Instructions */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="font-medium">{t('Transfer Details')}</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={copyInstructions}
                                        className="gap-2 h-8"
                                        aria-label={copied ? t('Copied!') : t('Copy')}
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="h-3 w-3 text-success" />
                                                {t('Copied!')}
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="h-3 w-3" />
                                                {t('Copy')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <div className="p-4 bg-muted rounded-lg font-mono text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                                    {bankTransferData.instructions}
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" className="w-full" onClick={handleClose}>
                                {t('Close')}
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                {t('Buy Credits')}
                            </DialogTitle>
                            <DialogDescription>
                                {t('Purchase a credit pack to keep building')}
                            </DialogDescription>
                        </DialogHeader>

                        {packs.length === 0 ? (
                            <div className="text-center py-6">
                                <p className="text-muted-foreground">
                                    {t('No credit packs available right now.')}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4 w-full">
                                    {/* Pack selection */}
                                    <RadioGroup
                                        value={selectedPackId ? String(selectedPackId) : ''}
                                        onValueChange={(v) => setSelectedPackId(Number(v))}
                                        className="space-y-2"
                                    >
                                        {packs.map((pack) => {
                                            const isSelected = pack.id === selectedPackId;
                                            return (
                                                <label
                                                    key={pack.id}
                                                    htmlFor={`pack-${pack.id}`}
                                                    className="block cursor-pointer"
                                                >
                                                    <Card
                                                        className={`relative p-4 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ${
                                                            isSelected ? 'border-primary ring-2 ring-primary bg-primary/5' : 'hover:border-primary/50'
                                                        }`}
                                                    >
                                                        <RadioGroupItem value={String(pack.id)} id={`pack-${pack.id}`} className="sr-only" />
                                                        <div className="flex items-center justify-between gap-4">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="font-semibold">{pack.name}</span>
                                                                    {pack.is_popular && (
                                                                        <Badge className="gap-1 px-2 py-0.5">
                                                                            <Star className="h-3 w-3" />
                                                                            {t('Popular')}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                                                    <span>
                                                                        {Number(pack.credits).toLocaleString()} {t('tokens')}
                                                                    </span>
                                                                    {pack.bonus_credits > 0 && (
                                                                        <Badge variant="outline" className="border-success text-success gap-1">
                                                                            <Gift className="h-3 w-3" />
                                                                            + {Number(pack.bonus_credits).toLocaleString()} {t('bonus')}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {pack.description && (
                                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                                                        {pack.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right flex-shrink-0">
                                                                <p className="text-lg font-bold whitespace-nowrap">
                                                                    {formatCurrency(Number(pack.price), pack.currency)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </label>
                                            );
                                        })}
                                    </RadioGroup>

                                    {/* Gateway selection */}
                                    {gateways.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-sm font-medium">{t('Select Payment Method')}</p>
                                            {gateways.map((gateway) => {
                                                const isSelected = gateway.slug === selectedGateway;
                                                return (
                                                    <Button
                                                        key={gateway.slug}
                                                        variant={isSelected ? 'default' : 'outline'}
                                                        className="w-full max-w-full justify-between h-auto py-3 gap-3"
                                                        onClick={() => setSelectedGateway(gateway.slug)}
                                                    >
                                                        <div className="text-start min-w-0 flex-1">
                                                            <div className="font-semibold">{gateway.name}</div>
                                                            {gateway.requires_manual_approval && (
                                                                <div className="text-xs opacity-80 line-clamp-1">
                                                                    {t('Manual approval')}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground text-center py-2">
                                            {t('No payment methods available.')}
                                        </p>
                                    )}
                                </div>

                                {/* Buy button */}
                                <DialogFooter>
                                    <Button
                                        className="w-full"
                                        size="lg"
                                        disabled={!selectedPackId || !selectedGateway || isProcessing}
                                        onClick={handleBuy}
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                                                {t('Processing...')}
                                            </>
                                        ) : (
                                            t('Buy')
                                        )}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
