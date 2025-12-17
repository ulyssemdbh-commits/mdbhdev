import { Receipt, Calendar, Building2, Check, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MerchantBilling, Merchant } from "@shared/schema";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

  const getMerchantName = (merchantId: string) => {
    const merchant = merchants.find(m => m.id === merchantId);
    return merchant?.name || "Commerçant inconnu";
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
          13% = 10% Cashback + 3% Frais REV + TVA 20%
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
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>Cashback: {formatCurrency(billing.cashbackAmount)}</span>
                        <span>Frais REV: {formatCurrency(billing.revFeeAmount)}</span>
                        <span>TVA: {formatCurrency(billing.tvaAmount)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge className={config.className}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                      <span className="font-semibold tabular-nums text-lg">
                        {formatCurrency(billing.totalBilled)}
                      </span>
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
