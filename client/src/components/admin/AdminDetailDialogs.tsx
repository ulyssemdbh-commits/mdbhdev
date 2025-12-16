import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Users, Store, TrendingUp, Euro, Mail, Calendar, Phone, MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { User, Merchant, Transaction } from "@shared/schema";

interface ClientsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientsListDialog({ open, onOpenChange }: ClientsListDialogProps) {
  const { data: clients = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/clients"],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Clients inscrits ({clients.length})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun client inscrit
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                  data-testid={`client-row-${client.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    {client.profileImageUrl ? (
                      <img
                        src={client.profileImageUrl}
                        alt={client.firstName || "Client"}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid={`text-client-name-${client.id}`}>
                      {client.firstName || client.lastName
                        ? `${client.firstName || ""} ${client.lastName || ""}`.trim()
                        : "Client"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-3 h-3" />
                      <span className="truncate">{client.email || "Email non renseigné"}</span>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {client.createdAt
                        ? format(new Date(client.createdAt), "dd MMM yyyy", { locale: fr })
                        : "N/A"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface MerchantsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MerchantsListDialog({ open, onOpenChange }: MerchantsListDialogProps) {
  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-600" />
            Commerçants ({merchants.length})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : merchants.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun commerçant
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              {merchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                  data-testid={`merchant-row-${merchant.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium" data-testid={`text-merchant-name-${merchant.id}`}>
                        {merchant.name}
                      </p>
                      <Badge variant={merchant.isActive ? "default" : "secondary"}>
                        {merchant.isActive ? "Actif" : "En attente"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                      {merchant.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {merchant.address}
                        </span>
                      )}
                      {merchant.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {merchant.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <Badge variant="outline">{merchant.category}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface TransactionsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionsListDialog({ open, onOpenChange }: TransactionsListDialogProps) {
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: open,
  });

  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    enabled: open,
  });

  const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(parseFloat(value));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Transactions ({transactions.length})
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune transaction
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                  data-testid={`transaction-row-${tx.id}`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {merchantMap.get(tx.merchantId) || "Commerçant"}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(tx.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                      </span>
                      <Badge 
                        variant={tx.status === "completed" ? "default" : tx.status === "cancelled" ? "destructive" : "secondary"}
                      >
                        {tx.status === "completed" ? "Terminée" : tx.status === "cancelled" ? "Annulée" : "En attente"}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg" data-testid={`text-tx-amount-${tx.id}`}>
                      {formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Commission: {formatCurrency(tx.commissionAmount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface CommissionsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommissionsListDialog({ open, onOpenChange }: CommissionsListDialogProps) {
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: open,
  });

  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    enabled: open,
  });

  const completedTx = transactions.filter((tx) => tx.status === "completed");
  const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

  const commissionsByMerchant = completedTx.reduce((acc, tx) => {
    if (!acc[tx.merchantId]) {
      acc[tx.merchantId] = { total: 0, count: 0 };
    }
    acc[tx.merchantId].total += parseFloat(tx.commissionAmount);
    acc[tx.merchantId].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const commissionsList = Object.entries(commissionsByMerchant)
    .map(([merchantId, data]) => ({
      merchantId,
      merchantName: merchantMap.get(merchantId) || "Commerçant",
      ...data,
    }))
    .sort((a, b) => b.total - a.total);

  const totalCommissions = commissionsList.reduce((sum, c) => sum + c.total, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-amber-600" />
            Commissions par commerçant
          </DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-4 rounded-md bg-amber-100 dark:bg-amber-900/30">
          <p className="text-sm text-muted-foreground">Total des commissions</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(totalCommissions)}
          </p>
        </div>
        <ScrollArea className="max-h-[50vh]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : commissionsList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune commission
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              {commissionsList.map((commission) => (
                <div
                  key={commission.merchantId}
                  className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                  data-testid={`commission-row-${commission.merchantId}`}
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Euro className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium" data-testid={`text-commission-merchant-${commission.merchantId}`}>
                      {commission.merchantName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {commission.count} transaction{commission.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg text-amber-700 dark:text-amber-400">
                      {formatCurrency(commission.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
