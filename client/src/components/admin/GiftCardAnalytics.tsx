import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, ShoppingCart, Send, TrendingUp, Loader2, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useState } from "react";
import type { GiftCard, GiftCardPurchase } from "@shared/schema";

interface GiftCardAnalyticsData {
  totalPurchases: number;
  totalRevenue: number;
  totalTransferred: number;
  purchasesByCard: { giftCardId: string; title: string; count: number; revenue: number }[];
}

interface PurchaseWithDetails extends GiftCardPurchase {
  giftCard?: GiftCard;
  buyerName: string;
  buyerEmail: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function GiftCardAnalytics() {
  const [purchasesDialogOpen, setPurchasesDialogOpen] = useState(false);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<GiftCardAnalyticsData>({
    queryKey: ["/api/admin/gift-cards/analytics"],
  });

  const { data: purchases, isLoading: purchasesLoading } = useQuery<PurchaseWithDetails[]>({
    queryKey: ["/api/admin/gift-cards/purchases"],
  });

  const { data: giftCards, isLoading: cardsLoading } = useQuery<GiftCard[]>({
    queryKey: ["/api/admin/gift-cards"],
  });

  if (analyticsLoading || purchasesLoading || cardsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = analytics || { totalPurchases: 0, totalRevenue: 0, totalTransferred: 0, purchasesByCard: [] };
  const purchaseList = purchases || [];
  const cardsList = giftCards || [];

  const chartData = stats.purchasesByCard.map((item, index) => ({
    ...item,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Achats totaux</p>
                <p className="text-2xl font-bold">{stats.totalPurchases}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <ShoppingCart className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Chiffre d'affaires</p>
                <p className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)} EUR</p>
              </div>
              <div className="p-3 bg-green-500/10 rounded-full">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Transferts</p>
                <p className="text-2xl font-bold">{stats.totalTransferred}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Ventes par carte cadeau</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="title" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value}`, 'Ventes']}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Revenus par carte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="revenue"
                      nameKey="title"
                      label={({ title, percent }) => `${title} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} EUR`, 'Revenu']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Cartes cadeaux ({cardsList.length})
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setPurchasesDialogOpen(true)} data-testid="button-view-purchases">
            <Eye className="w-4 h-4 mr-2" />
            Voir les achats
          </Button>
        </CardHeader>
        <CardContent>
          {cardsList.length > 0 ? (
            <div className="space-y-3">
              {cardsList.map((card) => {
                const cardStats = stats.purchasesByCard.find(c => c.giftCardId === card.id);
                return (
                  <div key={card.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{card.title}</span>
                        <Badge variant={card.isActive ? "default" : "secondary"} className="text-xs">
                          {card.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {parseFloat(card.faceValue).toFixed(2)} EUR
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{cardStats?.count || 0} ventes</p>
                      <p className="text-sm text-muted-foreground">
                        {(cardStats?.revenue || 0).toFixed(2)} EUR
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune carte cadeau configuree
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={purchasesDialogOpen} onOpenChange={setPurchasesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historique des achats de cartes cadeaux</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {purchaseList.length > 0 ? (
              purchaseList.map((purchase) => (
                <div key={purchase.id} className="p-4 border rounded-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{purchase.giftCard?.title || "Carte cadeau"}</p>
                      <p className="text-sm text-muted-foreground">
                        Acheteur: {purchase.buyerName || purchase.buyerEmail}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(purchase.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{parseFloat(purchase.purchaseAmount).toFixed(2)} EUR</p>
                      <Badge variant="outline" className="text-xs">
                        {purchase.status === "completed" ? "Termine" : purchase.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Aucun achat enregistre
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
