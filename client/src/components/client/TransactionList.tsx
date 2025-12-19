import { TrendingUp, TrendingDown, Clock, XCircle, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface Transaction {
  id: string;
  merchantName: string;
  amount: number;
  status: "pending" | "earned" | "used" | "cancelled";
  date: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  maxHeight?: string;
}

const statusConfig = {
  pending: {
    label: "En attente",
    variant: "secondary" as const,
    icon: Clock,
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  earned: {
    label: "Gagne",
    variant: "secondary" as const,
    icon: TrendingUp,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  used: {
    label: "Utilise",
    variant: "secondary" as const,
    icon: TrendingDown,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  cancelled: {
    label: "Annule",
    variant: "destructive" as const,
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function TransactionList({ transactions, maxHeight = "400px" }: TransactionListProps) {
  const formatCurrency = (amount: number) => {
    const prefix = amount >= 0 ? "+" : "";
    return prefix + new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(Math.abs(amount));
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-muted/50">
        <CardTitle className="flex items-center justify-center gap-2 text-base font-semibold">
          <Receipt className="w-4 h-4 text-primary" />
          Mes derniers CashBack
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ height: maxHeight }} className="px-4 pb-4">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune transaction
            </p>
          ) : (
            <div className="space-y-2 pt-2">
              {transactions.map((tx) => {
                const config = statusConfig[tx.status];
                const Icon = config.icon;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    data-testid={`transaction-item-${tx.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-background shadow-sm">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{tx.merchantName}</p>
                        <p className="text-xs text-muted-foreground">{tx.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={config.className}>
                        {config.label}
                      </Badge>
                      <span
                        className={`font-semibold tabular-nums text-sm ${
                          tx.status === "earned" || tx.status === "pending"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : tx.status === "cancelled"
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        }`}
                      >
                        {tx.status === "used" ? "-" : "+"}{formatCurrency(tx.amount).slice(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
