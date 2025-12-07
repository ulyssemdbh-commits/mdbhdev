import { User, MoreVertical, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MerchantTransaction {
  id: string;
  clientName: string;
  clientId: string;
  amount: number;
  cashbackGenerated: number;
  status: "pending" | "completed" | "cancelled";
  date: string;
  canCancel: boolean;
}

interface MerchantTransactionListProps {
  transactions: MerchantTransaction[];
  onCancelTransaction?: (id: string) => void;
  maxHeight?: string;
}

const statusConfig = {
  pending: {
    label: "En attente",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  completed: {
    label: "Validée",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  cancelled: {
    label: "Annulée",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function MerchantTransactionList({
  transactions,
  onCancelTransaction,
  maxHeight = "400px",
}: MerchantTransactionListProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Transactions récentes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea style={{ maxHeight }} className="px-6 pb-6">
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune transaction
            </p>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx) => {
                const config = statusConfig[tx.status];
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0"
                    data-testid={`merchant-tx-${tx.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{tx.clientName}</p>
                        <p className="text-sm text-muted-foreground">{tx.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(tx.amount)}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(tx.cashbackGenerated)} CB
                        </p>
                      </div>
                      <Badge className={config.className}>
                        {config.label}
                      </Badge>
                      {tx.canCancel && onCancelTransaction && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" data-testid={`button-tx-menu-${tx.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive gap-2"
                              onClick={() => onCancelTransaction(tx.id)}
                            >
                              <XCircle className="w-4 h-4" />
                              Annuler la transaction
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
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
