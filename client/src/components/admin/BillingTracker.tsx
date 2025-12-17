import { Receipt, Calendar, Building2, Check, Clock, AlertTriangle, Download, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { MerchantBilling, Merchant } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { generateBillingPdf } from "@/lib/billingPdf";

interface BillingTrackerProps {
  billings: MerchantBilling[];
  merchants: Merchant[];
  onMarkAsPaid: (billingId: string) => void;
  onGenerateBillings: () => void;
  isGenerating: boolean;
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

export function BillingTracker({
  billings,
  merchants,
  onMarkAsPaid,
  onGenerateBillings,
  isGenerating,
}: BillingTrackerProps) {
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

  const getMerchant = (merchantId: string) => {
    return merchants.find(m => m.id === merchantId);
  };

  const getMerchantName = (merchantId: string) => {
    const merchant = getMerchant(merchantId);
    return merchant?.name || "Commerçant inconnu";
  };

  const handleDownloadPdf = (billing: MerchantBilling) => {
    const merchant = getMerchant(billing.merchantId);
    generateBillingPdf({
      id: billing.id,
      merchantName: merchant?.name || "Commerçant inconnu",
      merchantAddress: merchant?.address || undefined,
      merchantCity: merchant?.city || undefined,
      merchantPostalCode: merchant?.postalCode || undefined,
      merchantSiret: merchant?.siret || undefined,
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

  const totalOverdue = billings
    .filter(b => b.status === "overdue")
    .reduce((sum, b) => sum + parseFloat(b.totalBilled), 0);

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Facturation Commerçants
          </CardTitle>
          <Button
            size="sm"
            onClick={onGenerateBillings}
            disabled={isGenerating}
            data-testid="button-generate-billings"
          >
            {isGenerating ? "Génération..." : "Générer Factures"}
          </Button>
        </div>
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
          {totalOverdue > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-muted-foreground">
                En retard: {formatCurrency(totalOverdue)}
              </span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          13% = 10% Cashback + 3% Frais REV + TVA 20% + Bons Plans (19€/sem.)
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <div className="px-6 pb-6 space-y-2">
            {billings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune facture à afficher
              </p>
            ) : (
              billings.map((billing) => {
                const config = statusConfig[billing.status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = config.icon;
                return (
                  <div
                    key={billing.id}
                    className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0"
                    data-testid={`billing-item-${billing.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <p className="font-medium truncate">{getMerchantName(billing.merchantId)}</p>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatPeriod(billing.periodStart, billing.periodEnd)}</span>
                        <span>|</span>
                        <span>CA: {formatCurrency(billing.totalSales)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>Cashback: {formatCurrency(billing.cashbackAmount)}</span>
                        <span>Frais REV: {formatCurrency(billing.revFeeAmount)}</span>
                        <span>TVA: {formatCurrency(billing.tvaAmount)}</span>
                        {(billing as any).promotionCharges && parseFloat((billing as any).promotionCharges) > 0 && (
                          <span>Bons Plans: {formatCurrency((billing as any).promotionCharges)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={config.className}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="font-semibold tabular-nums text-lg">
                        {formatCurrency(billing.totalBilled)}
                      </span>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`button-view-billing-${billing.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Détails de la facture</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-lg">{getMerchantName(billing.merchantId)}</p>
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
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">TVA (20%)</span>
                                <span>{formatCurrency(billing.tvaAmount)}</span>
                              </div>
                              {(billing as any).promotionCharges && parseFloat((billing as any).promotionCharges) > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">
                                    Bons Plans ({(billing as any).promotionWeeks} sem. x 19€)
                                  </span>
                                  <span>{formatCurrency((billing as any).promotionCharges)}</span>
                                </div>
                              )}
                              <div className="flex justify-between border-t pt-2">
                                <span className="font-semibold">Total à payer</span>
                                <span className="font-semibold text-lg">{formatCurrency(billing.totalBilled)}</span>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                              <Button
                                variant="outline"
                                onClick={() => handleDownloadPdf(billing)}
                                data-testid={`button-download-pdf-${billing.id}`}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Télécharger PDF
                              </Button>
                              {billing.status === "pending" && (
                                <Button
                                  onClick={() => onMarkAsPaid(billing.id)}
                                  data-testid={`button-mark-paid-dialog-${billing.id}`}
                                >
                                  Marquer payée
                                </Button>
                              )}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDownloadPdf(billing)}
                        data-testid={`button-download-billing-${billing.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      {billing.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onMarkAsPaid(billing.id)}
                          data-testid={`button-mark-paid-${billing.id}`}
                        >
                          Marquer payée
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
