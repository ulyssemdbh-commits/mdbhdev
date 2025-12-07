import { Euro, Calendar, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface WeeklyCommission {
  merchantId: string;
  merchantName: string;
  weekLabel: string;
  totalSales: number;
  commission: number;
  status: "pending" | "collected" | "overdue";
}

interface CommissionTrackerProps {
  commissions: WeeklyCommission[];
  totalPending: number;
  totalCollected: number;
}

const statusConfig = {
  pending: {
    label: "À prélever",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  collected: {
    label: "Prélevée",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  overdue: {
    label: "En retard",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function CommissionTracker({
  commissions,
  totalPending,
  totalCollected,
}: CommissionTrackerProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Euro className="w-5 h-5" />
          Suivi des commissions
        </CardTitle>
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span className="text-sm text-muted-foreground">
              En attente: {formatCurrency(totalPending)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-sm text-muted-foreground">
              Collectées: {formatCurrency(totalCollected)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[300px]">
          <div className="px-6 pb-6 space-y-2">
            {commissions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune commission à afficher
              </p>
            ) : (
              commissions.map((item, index) => {
                const config = statusConfig[item.status];
                return (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0"
                    data-testid={`commission-item-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.merchantName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{item.weekLabel}</span>
                        <span>•</span>
                        <span>CA: {formatCurrency(item.totalSales)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge className={config.className}>
                        {config.label}
                      </Badge>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(item.commission)}
                      </span>
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
