import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Camera, BarChart3, Loader2, Receipt, Tag } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { AccountSection } from "@/components/shared/AccountSection";
import { QRScanner } from "@/components/merchant/QRScanner";
import { TransactionForm } from "@/components/merchant/TransactionForm";
import { MerchantTransactionList, type MerchantTransaction } from "@/components/merchant/MerchantTransactionList";
import { MerchantBillings } from "@/components/merchant/MerchantBillings";
import { MerchantPromotions } from "@/components/merchant/MerchantPromotions";
import MerchantStatistics from "@/pages/merchant-statistics";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Merchant, Transaction } from "@shared/schema";

type MerchantView = "scanner" | "form" | "dashboard" | "statistics" | "billings" | "promotions";

interface ClientCashbackInfo {
  clientId: string;
  clientName: string | null;
  totalAvailable: string;
  totalPending: string;
  totalBalance: string;
}

export default function MerchantDashboard() {
  const [view, setView] = useState<MerchantView>("dashboard");
  const [scannedClientId, setScannedClientId] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  useSocket("merchant");

  const { data: clientCashbackInfo } = useQuery<ClientCashbackInfo>({
    queryKey: ["/api/merchant/client", scannedClientId, "cashback"],
    enabled: !!scannedClientId,
  });

  const { data: merchantProfile, isLoading: merchantLoading } = useQuery<Merchant>({
    queryKey: ["/api/merchant/me"],
  });

  const { data: transactionsData = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions/merchant"],
  });

  const createTransactionMutation = useMutation({
    mutationFn: async ({ clientId, amount }: { clientId: string; amount: number }) => {
      return apiRequest("POST", "/api/transactions", { clientId, amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/merchant"] });
    },
  });

  const cancelTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/transactions/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/merchant"] });
    },
  });

  const merchantName = merchantProfile?.name || "Commerçant";

  // Transform transactions for display
  const transactions: MerchantTransaction[] = transactionsData.map((tx) => {
    const createdAt = new Date(tx.createdAt);
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const canCancel = tx.status === "completed" && createdAt > twoHoursAgo;

    return {
      id: tx.id,
      clientName: "Client REV",
      clientId: tx.clientId,
      amount: parseFloat(tx.amount),
      cashbackGenerated: parseFloat(tx.cashbackAmount),
      status: tx.status as "completed" | "pending" | "cancelled",
      date: createdAt.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      canCancel,
    };
  });

  const handleScanSuccess = (clientId: string) => {
    setScannedClientId(clientId);
    setView("form");
  };

  const handleTransactionSubmit = async (amount: number) => {
    if (!scannedClientId) return;

    try {
      await createTransactionMutation.mutateAsync({ clientId: scannedClientId, amount });
      toast({
        title: "Transaction validée",
        description: `${amount.toFixed(2)}€ enregistré - ${(amount * 0.1).toFixed(2)}€ de cashback généré`,
      });
      setScannedClientId(null);
      setView("dashboard");
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la transaction",
        variant: "destructive",
      });
    }
  };

  const handleCancelTransaction = async (id: string) => {
    try {
      const response = await cancelTransactionMutation.mutateAsync(id);
      if (response.ok) {
        toast({
          title: "Transaction annulée",
          description: "La transaction et le cashback associé ont été annulés",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorMessage = error.message?.includes(":")
        ? error.message.split(":").slice(1).join(":").trim()
        : error.message || "Impossible d'annuler la transaction";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (view === "statistics") {
    return <MerchantStatistics onBack={() => setView("dashboard")} merchantProfile={merchantProfile} />;
  }

  if (view === "billings" && merchantProfile) {
    return (
      <div className="min-h-screen bg-background">
        <Header title={merchantName} />
        <main className="container max-w-lg px-4 py-6">
          <MerchantBillings 
            merchant={merchantProfile} 
            onBack={() => setView("dashboard")} 
          />
        </main>
      </div>
    );
  }

  if (view === "promotions") {
    return (
      <div className="min-h-screen bg-background">
        <Header title={merchantName} />
        <main className="container max-w-lg px-4 py-6">
          <MerchantPromotions onBack={() => setView("dashboard")} />
        </main>
      </div>
    );
  }

  const isLoading = merchantLoading || transactionsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header title={merchantName} />

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
                  Scannez un REV CODE
                </Button>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <MerchantTransactionList
                transactions={transactions}
                onCancelTransaction={handleCancelTransaction}
              />
            )}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setView("statistics")}
              data-testid="button-view-statistics"
            >
              <BarChart3 className="w-5 h-5" />
              Voir les statistiques détaillées
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setView("billings")}
              data-testid="button-view-billings"
            >
              <Receipt className="w-5 h-5" />
              Mes factures REV
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setView("promotions")}
              data-testid="button-view-promotions"
            >
              <Tag className="w-5 h-5" />
              Mes Bons Plans
            </Button>

            <AccountSection 
              user={{
                id: (user as any)?.id,
                email: (user as any)?.email,
                firstName: (user as any)?.firstName,
                lastName: (user as any)?.lastName,
                profileImageUrl: (user as any)?.profileImageUrl,
                role: "merchant",
              }} 
              showRole 
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
            clientName={clientCashbackInfo?.clientName || undefined}
            clientCashbackAvailable={clientCashbackInfo?.totalAvailable}
            clientCashbackPending={clientCashbackInfo?.totalPending}
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
