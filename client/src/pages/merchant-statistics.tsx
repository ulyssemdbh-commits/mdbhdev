import { useState, useMemo } from "react";
import { ArrowLeft, Download, TrendingUp, TrendingDown, Users, ShoppingCart, Wallet, Calendar } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
}

const mockDailyStats: DailyStats[] = [
  { date: "2025-12-07", transactions: 12, sales: 245.50, commission: 31.92, clients: 8, cashbackUsed: 18.50 },
  { date: "2025-12-06", transactions: 15, sales: 312.00, commission: 40.56, clients: 11, cashbackUsed: 25.00 },
  { date: "2025-12-05", transactions: 8, sales: 178.90, commission: 23.26, clients: 6, cashbackUsed: 12.40 },
  { date: "2025-12-04", transactions: 18, sales: 425.00, commission: 55.25, clients: 14, cashbackUsed: 35.80 },
  { date: "2025-12-03", transactions: 10, sales: 198.50, commission: 25.81, clients: 7, cashbackUsed: 15.20 },
  { date: "2025-12-02", transactions: 14, sales: 287.30, commission: 37.35, clients: 10, cashbackUsed: 22.00 },
  { date: "2025-12-01", transactions: 9, sales: 156.80, commission: 20.38, clients: 5, cashbackUsed: 8.50 },
  { date: "2025-11-30", transactions: 20, sales: 478.00, commission: 62.14, clients: 16, cashbackUsed: 42.00 },
  { date: "2025-11-29", transactions: 11, sales: 234.50, commission: 30.49, clients: 9, cashbackUsed: 19.00 },
  { date: "2025-11-28", transactions: 16, sales: 356.70, commission: 46.37, clients: 12, cashbackUsed: 28.50 },
  { date: "2025-11-15", transactions: 13, sales: 289.00, commission: 37.57, clients: 10, cashbackUsed: 21.00 },
  { date: "2025-11-01", transactions: 22, sales: 512.00, commission: 66.56, clients: 18, cashbackUsed: 45.00 },
  { date: "2025-10-15", transactions: 19, sales: 445.00, commission: 57.85, clients: 15, cashbackUsed: 38.00 },
  { date: "2025-09-01", transactions: 25, sales: 589.00, commission: 76.57, clients: 20, cashbackUsed: 52.00 },
];

const accountOpeningDate = "2025-06-15";

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

export default function MerchantStatistics({ onBack }: MerchantStatisticsProps) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("week");
  const { toast } = useToast();

  const merchantName = "Boulangerie Antoine";

  const filteredStats = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    
    return mockDailyStats.filter((stat) => {
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
  }, [periodFilter]);

  const totals = useMemo(() => {
    return filteredStats.reduce(
      (acc, stat) => ({
        transactions: acc.transactions + stat.transactions,
        sales: acc.sales + stat.sales,
        commission: acc.commission + stat.commission,
        clients: acc.clients + stat.clients,
        cashbackUsed: acc.cashbackUsed + stat.cashbackUsed,
      }),
      { transactions: 0, sales: 0, commission: 0, clients: 0, cashbackUsed: 0 }
    );
  }, [filteredStats]);

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
    doc.text(`Cashback utilisé: ${formatCurrency(totals.cashbackUsed)}`, 14, 81);
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

  const handleLogout = () => {
    console.log("Merchant logout triggered");
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
      title: "Cashback utilisé", 
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
      <Header title={merchantName} onLogout={handleLogout} />

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
              Aucune donnée pour cette période
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full gap-2"
          size="lg"
          onClick={generatePDF}
          data-testid="button-download-pdf"
        >
          <Download className="w-5 h-5" />
          Télécharger en PDF
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Compte ouvert le {formatDate(accountOpeningDate)}
        </p>
      </main>
    </div>
  );
}
