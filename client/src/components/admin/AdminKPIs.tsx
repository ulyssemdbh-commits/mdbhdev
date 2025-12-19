import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Users, DollarSign, Activity, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";

interface AdminKPIsData {
  totalGMV: number;
  totalRevenue: number;
  totalUsers: number;
  activeUsers: number;
  avgRevenuePerUser: number;
  userGrowth: number;
  transactionGrowth: number;
}

export function AdminKPIs() {
  const { data: kpis, isLoading } = useQuery<AdminKPIsData>({
    queryKey: ["/api/admin/kpis"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = kpis || {
    totalGMV: 0,
    totalRevenue: 0,
    totalUsers: 0,
    activeUsers: 0,
    avgRevenuePerUser: 0,
    userGrowth: 0,
    transactionGrowth: 0,
  };

  const kpiCards = [
    {
      title: "Volume Total (GMV)",
      value: `${stats.totalGMV.toFixed(2)} EUR`,
      icon: DollarSign,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Revenus (Commissions)",
      value: `${stats.totalRevenue.toFixed(2)} EUR`,
      icon: TrendingUp,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Utilisateurs totaux",
      value: stats.totalUsers.toString(),
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      growth: stats.userGrowth,
    },
    {
      title: "Utilisateurs actifs (30j)",
      value: stats.activeUsers.toString(),
      icon: Activity,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Revenu/Utilisateur",
      value: `${stats.avgRevenuePerUser.toFixed(2)} EUR`,
      icon: DollarSign,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      title: "Croissance transactions",
      value: `${stats.transactionGrowth >= 0 ? '+' : ''}${stats.transactionGrowth.toFixed(1)}%`,
      icon: stats.transactionGrowth >= 0 ? TrendingUp : TrendingDown,
      color: stats.transactionGrowth >= 0 ? "text-green-500" : "text-red-500",
      bgColor: stats.transactionGrowth >= 0 ? "bg-green-500/10" : "bg-red-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {kpiCards.map((kpi, index) => (
        <Card key={index}>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{kpi.title}</p>
                <p className="text-lg font-bold mt-1">{kpi.value}</p>
                {kpi.growth !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    {kpi.growth >= 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-green-500" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-red-500" />
                    )}
                    <span className={`text-xs ${kpi.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {kpi.growth >= 0 ? '+' : ''}{kpi.growth.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
              <div className={`p-2 rounded-full ${kpi.bgColor}`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
