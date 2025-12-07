import { TrendingUp, Users, Receipt, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MerchantStatsProps {
  weeklyTransactions: number;
  weeklySales: number;
  weeklyCommission: number;
  totalClients: number;
}

export function MerchantStats({
  weeklyTransactions,
  weeklySales,
  weeklyCommission,
  totalClients,
}: MerchantStatsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const stats = [
    {
      label: "Ventes cette semaine",
      value: formatCurrency(weeklySales),
      icon: Euro,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      label: "Transactions",
      value: weeklyTransactions.toString(),
      icon: Receipt,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Clients fidélisés",
      value: totalClients.toString(),
      icon: Users,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      label: "Commission due (13%)",
      value: formatCurrency(weeklyCommission),
      icon: TrendingUp,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Cette semaine</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="p-3 rounded-md bg-muted/50 space-y-2"
                data-testid={`stat-card-${index}`}
              >
                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
