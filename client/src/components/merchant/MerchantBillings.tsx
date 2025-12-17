import { useQuery } from "@tanstack/react-query";
import { Receipt, Calendar, Download, Eye, Check, Clock, AlertTriangle, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { MerchantBilling, Merchant } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { generateBillingPdf } from "@/lib/billingPdf";

interface MerchantBillingsProps {
  merchant: Merchant;
  onBack: () => void;
}

const statusConfig = {
  pending: {
    label: "En attente",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    icon: Clock,
  },
  paid: {
    label: "Payée",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: Check,
  },
  overdue: {
    label: "En retard",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: AlertTriangle,
  },
};

export function MerchantBillings({ merchant, onBack }: MerchantBillingsProps) {
  const { data: billings = [], isLoading } = useQuery<MerchantBilling[]>({
    queryKey: ["/api/merchant/billings"],
  });

  const formatCurrency = (value: number | string) => {
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(numValue);
  };

  const formatPeriod = (start: Date | string, end: Date | string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${format(startDate, "d", { locale: fr })} - ${format(endDate, "d MMM yyyy", { locale: fr })}`;
  };

  const handleDownloadPdf = (billing: MerchantBilling) => {
    generateBillingPdf({
      id: billing.id,
      merchantName: merchant.name,
      merchantAddress: merchant.address || undefined,
      merchantCity: merchant.city || undefined,
      merchantPostalCode: merchant.postalCode || undefined,
      merchantSiret: merchant.siret || undefined,
      periodStart: billing.periodStart,
      periodEnd: billing.periodEnd,
      totalSales: billing.totalSales,
      cashbackAmount: billing.cashbackAmount,
      revFeeAmount: billing.revFeeAmount,
      tvaAmount: billing.tvaAmount,
      promotionCharges: (billing as any).promotionCharges,
      promotionWeeks: (billing as any).promotionWeeks,
      totalBilled: billing.totalBilled,
      status: billing.status,
      dueDate: billing.dueDate,
      paidAt: billing.paidAt,
    });
  };

  const totalPending = billings
    .filter(b => b.status === "pending")
    .reduce((sum, b) => sum + parseFloat(b.totalBilled), 0);

  const totalPaid = billings
    .filter(b => b.status === "paid")
    .reduce((sum, b) => sum + parseFloat(b.totalBilled), 0);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        onClick={onBack}
        className="gap-2"
        data-testid="button-back-from-billings"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour
      </Button>

      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Mes Factures REV
          </CardTitle>
          <div className="flex gap-4 mt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-muted-foreground">
                En attente: {formatCurrency(totalPending)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">
                Payées: {formatCurrency(totalPaid)}
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            13% = 10% Cashback + 3% Frais REV + TVA 20% + Bons Plans (19€/sem.)
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="px-6 pb-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="px-6 pb-6 space-y-3">
                {billings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Aucune facture à afficher
                  </p>
                ) : (
                  billings.map((billing) => {
                    const config = statusConfig[billing.status as keyof typeof statusConfig] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <Card key={billing.id} className="border-card-border" data-testid={`merchant-billing-${billing.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={config.className}>
                                  <StatusIcon className="w-3 h-3 mr-1" />
                                  {config.label}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  Facture N° REV-{billing.id.toString().padStart(6, '0')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calendar className="w-3 h-3" />
                                <span>{formatPeriod(billing.periodStart, billing.periodEnd)}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Ventes: </span>
                                  <span className="font-medium">{formatCurrency(billing.totalSales)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Cashback: </span>
                                  <span>{formatCurrency(billing.cashbackAmount)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Commission: </span>
                                  <span>{formatCurrency(billing.revFeeAmount)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">TVA: </span>
                                  <span>{formatCurrency(billing.tvaAmount)}</span>
                                </div>
                                {(billing as any).promotionCharges && parseFloat((billing as any).promotionCharges) > 0 && (
                                  <div className="col-span-2">
                                    <span className="text-muted-foreground">Bons Plans: </span>
                                    <span>{formatCurrency((billing as any).promotionCharges)}</span>
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({(billing as any).promotionWeeks} sem.)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-lg">{formatCurrency(billing.totalBilled)}</p>
                              <p className="text-xs text-muted-foreground">
                                Échéance: {format(new Date(billing.dueDate), "d MMM", { locale: fr })}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid={`button-view-merchant-billing-${billing.id}`}
                                >
                                  <Eye className="w-4 h-4 mr-2" />
                                  Détails
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                <DialogHeader>
                                  <DialogTitle>Détails de la facture</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-semibold text-lg">{merchant.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        Facture N° REV-{billing.id.toString().padStart(6, '0')}
                                      </p>
                                    </div>
                                    <Badge className={config.className}>
                                      <StatusIcon className="w-3 h-3 mr-1" />
                                      {config.label}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Période</p>
                                      <p className="font-medium">{formatPeriod(billing.periodStart, billing.periodEnd)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Échéance</p>
                                      <p className="font-medium">{format(new Date(billing.dueDate), "d MMM yyyy", { locale: fr })}</p>
                                    </div>
                                  </div>
                                  <div className="border-t pt-4 space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Ventes totales</span>
                                      <span className="font-medium">{formatCurrency(billing.totalSales)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Cashback (10%)</span>
                                      <span>{formatCurrency(billing.cashbackAmount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">Commission REV (3%)</span>
                                      <span>{formatCurrency(billing.revFeeAmount)}</span>
                                    </div>
                                    {(billing as any).promotionCharges && parseFloat((billing as any).promotionCharges) > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                          Bons Plans HT ({(billing as any).promotionWeeks} sem. x 19€)
                                        </span>
                                        <span>{formatCurrency((billing as any).promotionCharges)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between">
                                      <span className="text-muted-foreground">TVA 20% (Commission + Bons Plans)</span>
                                      <span>{formatCurrency(billing.tvaAmount)}</span>
                                    </div>
                                    <div className="flex justify-between border-t pt-2">
                                      <span className="font-semibold">Total à payer</span>
                                      <span className="font-semibold text-lg">{formatCurrency(billing.totalBilled)}</span>
                                    </div>
                                  </div>
                                  <div className="flex justify-end pt-4">
                                    <Button
                                      onClick={() => handleDownloadPdf(billing)}
                                      data-testid={`button-download-merchant-pdf-${billing.id}`}
                                    >
                                      <Download className="w-4 h-4 mr-2" />
                                      Télécharger PDF
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              onClick={() => handleDownloadPdf(billing)}
                              data-testid={`button-download-merchant-billing-${billing.id}`}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              PDF
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
