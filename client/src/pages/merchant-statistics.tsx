import { useState, useMemo } from "react";
import { ArrowLeft, Download, TrendingUp, Users, ShoppingCart, Wallet, Calendar, Loader2 } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { MerchantAnalytics } from "@/components/merchant/MerchantAnalytics";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Transaction, Merchant } from "@shared/schema";

type PeriodFilter = "day" | "week" | "month" | "year" | "all";

interface DailyStats {
  date: string;
  transactions: number;
  sales: number;
  commission: number;
  clients: number;
  cashbackUsed: number;
}

interface MerchantStatisticsProps {
  onBack: () => void;
  merchantProfile?: Merchant;
}

const periodLabels: Record<PeriodFilter, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  year: "Cette année",
  all: "Depuis l'ouverture",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace(".", ",") + " €";
}

export default function MerchantStatistics({ onBack, merchantProfile }: MerchantStatisticsProps) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("week");
  const { toast } = useToast();

  const merchantName = merchantProfile?.name || "Commerçant";
  const accountOpeningDate = merchantProfile?.createdAt 
    ? new Date(merchantProfile.createdAt).toISOString().split("T")[0]
    : "2025-01-01";

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/merchant"],
  });

  const dailyStats = useMemo(() => {
    const completedTransactions = transactions.filter(tx => tx.status === "completed");
    
    const statsByDate = new Map<string, DailyStats>();
    const clientsByDate = new Map<string, Set<string>>();
    
    completedTransactions.forEach(tx => {
      const date = new Date(tx.createdAt).toISOString().split("T")[0];
      const amount = parseFloat(tx.amount);
      const cashbackAmount = parseFloat(tx.cashbackAmount || "0");
      const commission = amount * 0.13;
      
      if (!statsByDate.has(date)) {
        statsByDate.set(date, {
          date,
          transactions: 0,
          sales: 0,
          commission: 0,
          clients: 0,
          cashbackUsed: 0,
        });
        clientsByDate.set(date, new Set());
      }
      
      const stats = statsByDate.get(date)!;
      const clients = clientsByDate.get(date)!;
      
      stats.transactions += 1;
      stats.sales += amount;
      stats.commission += commission;
      stats.cashbackUsed += cashbackAmount;
      clients.add(tx.clientId);
    });

    statsByDate.forEach((stats, date) => {
      stats.clients = clientsByDate.get(date)?.size || 0;
    });

    return Array.from(statsByDate.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [transactions]);

  const filteredStats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    return dailyStats.filter((stat) => {
      const statDate = new Date(stat.date);
      
      switch (periodFilter) {
        case "day":
          return stat.date === today;
        case "week": {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return statDate >= weekAgo && statDate <= now;
        }
        case "month": {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return statDate >= monthAgo && statDate <= now;
        }
        case "year": {
          const yearAgo = new Date(now);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          return statDate >= yearAgo && statDate <= now;
        }
        case "all":
          return statDate >= new Date(accountOpeningDate);
        default:
          return true;
      }
    });
  }, [periodFilter, dailyStats, accountOpeningDate]);

  const totals = useMemo(() => {
    const uniqueClients = new Set<string>();
    const completedTransactions = transactions.filter(tx => tx.status === "completed");
    
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    completedTransactions.forEach(tx => {
      const txDate = new Date(tx.createdAt);
      const txDateStr = txDate.toISOString().split("T")[0];
      
      let include = false;
      switch (periodFilter) {
        case "day":
          include = txDateStr === today;
          break;
        case "week": {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          include = txDate >= weekAgo && txDate <= now;
          break;
        }
        case "month": {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          include = txDate >= monthAgo && txDate <= now;
          break;
        }
        case "year": {
          const yearAgo = new Date(now);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          include = txDate >= yearAgo && txDate <= now;
          break;
        }
        case "all":
          include = txDate >= new Date(accountOpeningDate);
          break;
      }
      
      if (include) {
        uniqueClients.add(tx.clientId);
      }
    });

    return {
      transactions: filteredStats.reduce((sum, s) => sum + s.transactions, 0),
      sales: filteredStats.reduce((sum, s) => sum + s.sales, 0),
      commission: filteredStats.reduce((sum, s) => sum + s.commission, 0),
      clients: uniqueClients.size,
      cashbackUsed: filteredStats.reduce((sum, s) => sum + s.cashbackUsed, 0),
    };
  }, [filteredStats, transactions, periodFilter, accountOpeningDate]);

  const generatePDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Statistiques " + merchantName, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Période: ${periodLabels[periodFilter]}`, 14, 32);
    doc.text(`Généré le: ${formatDate(new Date().toISOString())}`, 14, 40);
    
    doc.setFontSize(14);
    doc.text("Résumé", 14, 55);
    
    doc.setFontSize(11);
    doc.text(`Transactions: ${totals.transactions}`, 14, 65);
    doc.text(`Chiffre d'affaires: ${formatCurrency(totals.sales)}`, 14, 73);
    doc.text(`Cashback généré: ${formatCurrency(totals.cashbackUsed)}`, 14, 81);
    doc.text(`Commission REV (13%): ${formatCurrency(totals.commission)}`, 14, 89);
    doc.text(`Clients uniques: ${totals.clients}`, 14, 97);
    
    if (filteredStats.length > 0) {
      doc.setFontSize(14);
      doc.text("Détail par jour", 14, 113);
      
      autoTable(doc, {
        startY: 118,
        head: [["Date", "Transactions", "CA", "Cashback", "Commission", "Clients"]],
        body: filteredStats.map((stat) => [
          formatDate(stat.date),
          stat.transactions.toString(),
          formatCurrency(stat.sales),
          formatCurrency(stat.cashbackUsed),
          formatCurrency(stat.commission),
          stat.clients.toString(),
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [34, 139, 34] },
      });
    }
    
    doc.save(`statistiques_${merchantName.replace(/\s/g, "_")}_${periodFilter}.pdf`);
    
    toast({
      title: "PDF téléchargé",
      description: "Vos statistiques ont été exportées en PDF",
    });
  };

  const statCards = [
    { 
      title: "Transactions", 
      value: totals.transactions, 
      icon: ShoppingCart,
      format: (v: number) => v.toString()
    },
    { 
      title: "Chiffre d'affaires", 
      value: totals.sales, 
      icon: TrendingUp,
      format: formatCurrency
    },
    { 
      title: "Cashback généré", 
      value: totals.cashbackUsed, 
      icon: Wallet,
      format: formatCurrency
    },
    { 
      title: "Commission REV", 
      value: totals.commission, 
      icon: Wallet,
      format: formatCurrency
    },
    { 
      title: "Clients", 
      value: totals.clients, 
      icon: Users,
      format: (v: number) => v.toString()
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header title={merchantName} />

      <main className="container max-w-lg px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onBack}
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Statistiques détaillées</h1>
        </div>

        <Card className="border-card-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Période
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(periodLabels) as PeriodFilter[]).map((period) => (
                <Button
                  key={period}
                  size="sm"
                  variant={periodFilter === period ? "default" : "secondary"}
                  onClick={() => setPeriodFilter(period)}
                  data-testid={`filter-period-${period}`}
                >
                  {periodLabels[period]}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {statCards.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="border-card-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Icon className="w-4 h-4" />
                        <span className="text-xs">{stat.title}</span>
                      </div>
                      <p className="text-xl font-bold" data-testid={`stat-${stat.title.toLowerCase().replace(/\s/g, "-")}`}>
                        {stat.format(stat.value)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredStats.length > 0 ? (
              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Détail par jour</CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {filteredStats.map((stat, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                        data-testid={`stat-row-${index}`}
                      >
                        <div>
                          <p className="font-medium text-sm">{formatDate(stat.date)}</p>
                          <p className="text-xs text-muted-foreground">
                            {stat.transactions} transactions - {stat.clients} clients
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(stat.sales)}</p>
                          <p className="text-xs text-muted-foreground">
                            -{formatCurrency(stat.commission)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-card-border">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Aucune transaction pour cette période
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={generatePDF}
          disabled={isLoading || filteredStats.length === 0}
          data-testid="button-download-pdf"
        >
          <Download className="w-4 h-4" />
          Télécharger en PDF
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Compte ouvert le {formatDate(accountOpeningDate)}
        </p>
      </main>
    </div>
  );
}
