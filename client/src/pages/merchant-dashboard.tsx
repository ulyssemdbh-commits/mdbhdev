import { useState } from "react";
import { Camera, BarChart3 } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { QRScanner } from "@/components/merchant/QRScanner";
import { TransactionForm } from "@/components/merchant/TransactionForm";
import { MerchantStats } from "@/components/merchant/MerchantStats";
import { MerchantTransactionList, type MerchantTransaction } from "@/components/merchant/MerchantTransactionList";
import MerchantStatistics from "@/pages/merchant-statistics";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type MerchantView = "scanner" | "form" | "dashboard" | "statistics";

// todo: remove mock functionality
const mockTransactions: MerchantTransaction[] = [
  { id: "1", clientName: "Marie Dupont", clientId: "CLT-7X9K2M", amount: 25.50, cashbackGenerated: 2.55, status: "completed", date: "Aujourd'hui, 10:32", canCancel: true },
  { id: "2", clientName: "Pierre Martin", clientId: "CLT-3Y8P1N", amount: 42.00, cashbackGenerated: 4.20, status: "completed", date: "Aujourd'hui, 09:15", canCancel: false },
  { id: "3", clientName: "Sophie Bernard", clientId: "CLT-5Z2Q7R", amount: 18.90, cashbackGenerated: 1.89, status: "pending", date: "Hier, 17:45", canCancel: false },
  { id: "4", clientName: "Lucas Petit", clientId: "CLT-9W4S6T", amount: 35.00, cashbackGenerated: 3.50, status: "cancelled", date: "Hier, 14:20", canCancel: false },
];

export default function MerchantDashboard() {
  const [view, setView] = useState<MerchantView>("dashboard");
  const [scannedClientId, setScannedClientId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState(mockTransactions);
  const { toast } = useToast();

  // todo: remove mock functionality
  const merchantName = "Boulangerie Antoine";
  const weeklyStats = {
    transactions: 47,
    sales: 1250.80,
    commission: 162.60,
    clients: 32,
  };

  const handleScanSuccess = (clientId: string) => {
    setScannedClientId(clientId);
    setView("form");
  };

  const handleTransactionSubmit = (amount: number) => {
    const newTx: MerchantTransaction = {
      id: Date.now().toString(),
      clientName: "Client REV",
      clientId: scannedClientId || "CLT-UNKNOWN",
      amount,
      cashbackGenerated: amount * 0.1,
      status: "completed",
      date: "À l'instant",
      canCancel: true,
    };
    setTransactions([newTx, ...transactions]);
    toast({
      title: "Transaction validée",
      description: `${amount.toFixed(2)}€ enregistré - ${(amount * 0.1).toFixed(2)}€ de cashback généré`,
    });
    setScannedClientId(null);
    setView("dashboard");
  };

  const handleCancelTransaction = (id: string) => {
    setTransactions(transactions.map((tx) =>
      tx.id === id ? { ...tx, status: "cancelled" as const, canCancel: false } : tx
    ));
    toast({
      title: "Transaction annulée",
      description: "La transaction et le cashback associé ont été annulés",
      variant: "destructive",
    });
  };

  const handleLogout = () => {
    console.log("Merchant logout triggered");
  };

  if (view === "statistics") {
    return <MerchantStatistics onBack={() => setView("dashboard")} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title={merchantName} onLogout={handleLogout} />

      <main className="container max-w-lg px-4 py-6 space-y-6">
        {view === "dashboard" && (
          <>
            <Card className="border-card-border bg-primary text-primary-foreground">
              <CardContent className="p-4">
                <Button
                  size="lg"
                  variant="secondary"
                  className="w-full gap-3 h-14 text-lg"
                  onClick={() => setView("scanner")}
                  data-testid="button-open-scanner"
                >
                  <Camera className="w-6 h-6" />
                  Scanner un client
                </Button>
              </CardContent>
            </Card>

            <MerchantStats
              weeklyTransactions={weeklyStats.transactions}
              weeklySales={weeklyStats.sales}
              weeklyCommission={weeklyStats.commission}
              totalClients={weeklyStats.clients}
            />

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setView("statistics")}
              data-testid="button-view-statistics"
            >
              <BarChart3 className="w-5 h-5" />
              Voir les statistiques détaillées
            </Button>

            <MerchantTransactionList
              transactions={transactions}
              onCancelTransaction={handleCancelTransaction}
            />
          </>
        )}

        {view === "scanner" && (
          <QRScanner
            onScanSuccess={handleScanSuccess}
            onCancel={() => setView("dashboard")}
          />
        )}

        {view === "form" && scannedClientId && (
          <TransactionForm
            clientId={scannedClientId}
            onSubmit={handleTransactionSubmit}
            onCancel={() => {
              setScannedClientId(null);
              setView("dashboard");
            }}
          />
        )}
      </main>
    </div>
  );
}
