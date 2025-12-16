import { TrendingUp, Store, Users, Euro, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type AdminStatType = "transactions" | "merchants" | "clients" | "commissions";

interface AdminStatsProps {
  totalTransactions: number;
  totalMerchants: number;
  totalClients: number;
  totalCommissions: number;
  transactionGrowth?: number;
  merchantGrowth?: number;
  onCardClick?: (type: AdminStatType) => void;
}

export function AdminStats({
  totalTransactions,
  totalMerchants,
  totalClients,
  totalCommissions,
  transactionGrowth = 0,
  merchantGrowth = 0,
  onCardClick,
}: AdminStatsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("fr-FR").format(value);
  };

  const stats: Array<{
    type: AdminStatType;
    label: string;
    value: string;
    growth?: number;
    icon: typeof TrendingUp;
    color: string;
    bgColor: string;
  }> = [
    {
      type: "transactions",
      label: "Transactions totales",
      value: formatNumber(totalTransactions),
      growth: transactionGrowth,
      icon: TrendingUp,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      type: "merchants",
      label: "Commerçants actifs",
      value: formatNumber(totalMerchants),
      growth: merchantGrowth,
      icon: Store,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      type: "clients",
      label: "Clients inscrits",
      value: formatNumber(totalClients),
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      type: "commissions",
      label: "Commissions collectées",
      value: formatCurrency(totalCommissions),
      icon: Euro,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const isClickable = onCardClick !== undefined;
        return (
          <Card 
            key={index} 
            className={`border-card-border ${isClickable ? "cursor-pointer hover-elevate" : ""}`}
            onClick={() => onCardClick?.(stat.type)}
            data-testid={`admin-stat-${stat.type}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className={`inline-flex items-center justify-center w-10 h-10 rounded-md ${stat.bgColor}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-1">
                  {stat.growth !== undefined && stat.growth !== 0 && (
                    <span className={`text-xs font-medium ${stat.growth > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {stat.growth > 0 ? "+" : ""}{stat.growth}%
                    </span>
                  )}
                  {isClickable && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
