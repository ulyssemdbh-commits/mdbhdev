import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, Users, Euro, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Merchant, Transaction } from "@shared/schema";

interface MerchantStats {
  merchant: Merchant;
  totalTransactions: number;
  totalSales: number;
  totalCashback: number;
  totalCommission: number;
  monthlyData: { month: string; sales: number; transactions: number }[];
  recentTransactions: Transaction[];
}

interface MerchantDetailsDialogProps {
  merchantId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MerchantDetailsDialog({ merchantId, open, onOpenChange }: MerchantDetailsDialogProps) {
  const { data: stats, isLoading } = useQuery<MerchantStats>({
    queryKey: ["/api/admin/merchants", merchantId, "stats"],
    enabled: !!merchantId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {stats?.merchant.name || "Détails du commerçant"}
            {stats?.merchant.isActive ? (
              <Badge variant="default" className="bg-green-500">Actif</Badge>
            ) : (
              <Badge variant="secondary">En attente</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Transactions</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-merchant-transactions">
                    {stats.totalTransactions}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Euro className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Ventes totales</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-merchant-sales">
                    {stats.totalSales.toFixed(2)} €
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">Cashback distribué</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600" data-testid="text-merchant-cashback">
                    {stats.totalCashback.toFixed(2)} €
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Commission REV</span>
                  </div>
                  <p className="text-2xl font-bold" data-testid="text-merchant-commission">
                    {stats.totalCommission.toFixed(2)} €
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Catégorie</span>
                  <span className="font-medium capitalize">{stats.merchant.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Adresse</span>
                  <span className="font-medium">{stats.merchant.address || "Non renseignée"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inscrit le</span>
                  <span className="font-medium">
                    {new Date(stats.merchant.createdAt).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </CardContent>
            </Card>

            {stats.monthlyData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Évolution des ventes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="month" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          formatter={(value: number) => [`${value.toFixed(2)} €`, "Ventes"]}
                          labelClassName="font-medium"
                        />
                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {stats.recentTransactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transactions récentes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.recentTransactions.map((tx) => (
                      <div key={tx.id} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{parseFloat(tx.amount).toFixed(2)} €</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <Badge variant={tx.status === "completed" ? "default" : "secondary"}>
                          {tx.status === "completed" ? "Complété" : tx.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Impossible de charger les données
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
