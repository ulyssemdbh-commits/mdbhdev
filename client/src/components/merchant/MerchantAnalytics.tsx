import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, ShoppingCart, Target, Loader2, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MerchantAnalyticsData {
  totalSales: number;
  totalTransactions: number;
  totalCashback: number;
  uniqueClients: number;
  loyalClients: { clientId: string; visits: number; totalSpent: number }[];
  salesByMonth: { month: string; sales: number }[];
}

interface MerchantGoal {
  id: string;
  merchantId: string;
  month: string;
  year: string;
  salesGoal: string;
}

export function MerchantAnalytics() {
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [salesGoal, setSalesGoal] = useState("");
  const { toast } = useToast();

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const { data: analytics, isLoading } = useQuery<MerchantAnalyticsData>({
    queryKey: ["/api/merchant/analytics"],
  });

  const { data: currentGoal } = useQuery<MerchantGoal | null>({
    queryKey: ["/api/merchant/goals", currentMonth, currentYear],
  });

  const setGoalMutation = useMutation({
    mutationFn: async (goal: number) => {
      return apiRequest("/api/merchant/goals", {
        method: "POST",
        body: JSON.stringify({
          month: currentMonth,
          year: currentYear,
          salesGoal: goal,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/goals"] });
      setGoalDialogOpen(false);
      toast({
        title: "Objectif defini",
        description: "Votre objectif de ventes a ete enregistre",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = analytics || {
    totalSales: 0,
    totalTransactions: 0,
    totalCashback: 0,
    uniqueClients: 0,
    loyalClients: [],
    salesByMonth: [],
  };

  const goalAmount = currentGoal ? parseFloat(currentGoal.salesGoal) : 0;
  const goalProgress = goalAmount > 0 ? (stats.totalSales / goalAmount) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Ventes totales</p>
                <p className="text-xl font-bold">{stats.totalSales.toFixed(2)} EUR</p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="text-xl font-bold">{stats.totalTransactions}</p>
              </div>
              <ShoppingCart className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Clients uniques</p>
                <p className="text-xl font-bold">{stats.uniqueClients}</p>
              </div>
              <Users className="w-5 h-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Cashback distribue</p>
                <p className="text-xl font-bold">{stats.totalCashback.toFixed(2)} EUR</p>
              </div>
              <BarChart3 className="w-5 h-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            Objectif du mois
          </CardTitle>
          <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-set-goal">
                Definir
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Definir l'objectif de ventes</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  type="number"
                  placeholder="Montant en EUR"
                  value={salesGoal}
                  onChange={(e) => setSalesGoal(e.target.value)}
                  data-testid="input-sales-goal"
                />
                <Button
                  className="w-full"
                  onClick={() => setGoalMutation.mutate(parseFloat(salesGoal))}
                  disabled={!salesGoal || setGoalMutation.isPending}
                  data-testid="button-save-goal"
                >
                  {setGoalMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {goalAmount > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{stats.totalSales.toFixed(2)} EUR</span>
                <span>{goalAmount.toFixed(2)} EUR</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(goalProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {goalProgress.toFixed(0)}% de l'objectif atteint
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun objectif defini pour ce mois
            </p>
          )}
        </CardContent>
      </Card>

      {stats.salesByMonth.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolution des ventes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.salesByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value.toFixed(2)} EUR`, 'Ventes']}
                  />
                  <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {stats.loyalClients.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Clients fideles ({stats.loyalClients.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.loyalClients.slice(0, 10).map((client, index) => (
                <div key={client.clientId} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">{index + 1}</Badge>
                    <span className="text-sm">{client.visits} visites</span>
                  </div>
                  <span className="font-medium">{client.totalSpent.toFixed(2)} EUR</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
