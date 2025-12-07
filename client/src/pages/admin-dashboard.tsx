import { useState } from "react";
import { Header } from "@/components/shared/Header";
import { AdminStats } from "@/components/admin/AdminStats";
import { MerchantManagement, type AdminMerchant } from "@/components/admin/MerchantManagement";
import { CommissionTracker, type WeeklyCommission } from "@/components/admin/CommissionTracker";
import { useToast } from "@/hooks/use-toast";

// todo: remove mock functionality
const mockMerchants: AdminMerchant[] = [
  { id: "1", name: "Boulangerie Antoine", status: "active", joinDate: "15 oct. 2024", totalSales: 4520.80, hasBonsPlanPack: true },
  { id: "2", name: "Café Marcel", status: "active", joinDate: "22 oct. 2024", totalSales: 2180.50, hasBonsPlanPack: true },
  { id: "3", name: "Supermarché Bio", status: "pending", joinDate: "5 déc. 2024", totalSales: 0, hasBonsPlanPack: false },
  { id: "4", name: "Pharmacie Centrale", status: "active", joinDate: "1 nov. 2024", totalSales: 3890.20, hasBonsPlanPack: false },
  { id: "5", name: "Fleuriste Rose", status: "suspended", joinDate: "10 nov. 2024", totalSales: 650.00, hasBonsPlanPack: false },
];

// todo: remove mock functionality
const mockCommissions: WeeklyCommission[] = [
  { merchantId: "1", merchantName: "Boulangerie Antoine", weekLabel: "Sem. 49", totalSales: 850.40, commission: 110.55, status: "pending" },
  { merchantId: "2", merchantName: "Café Marcel", weekLabel: "Sem. 49", totalSales: 420.00, commission: 54.60, status: "pending" },
  { merchantId: "4", merchantName: "Pharmacie Centrale", weekLabel: "Sem. 49", totalSales: 720.80, commission: 93.70, status: "pending" },
  { merchantId: "1", merchantName: "Boulangerie Antoine", weekLabel: "Sem. 48", totalSales: 920.00, commission: 119.60, status: "collected" },
  { merchantId: "2", merchantName: "Café Marcel", weekLabel: "Sem. 48", totalSales: 380.50, commission: 49.47, status: "collected" },
];

export default function AdminDashboard() {
  const [merchants, setMerchants] = useState(mockMerchants);
  const { toast } = useToast();

  // todo: remove mock functionality
  const stats = {
    totalTransactions: 1847,
    totalMerchants: 24,
    totalClients: 892,
    totalCommissions: 8450.30,
    transactionGrowth: 12,
    merchantGrowth: 8,
  };

  const pendingCommissions = mockCommissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.commission, 0);

  const collectedCommissions = mockCommissions
    .filter((c) => c.status === "collected")
    .reduce((sum, c) => sum + c.commission, 0);

  const handleValidateMerchant = (id: string) => {
    setMerchants(merchants.map((m) =>
      m.id === id ? { ...m, status: "active" as const } : m
    ));
    toast({
      title: "Commerçant validé",
      description: "Le commerçant a été activé et peut maintenant utiliser REV",
    });
  };

  const handleSuspendMerchant = (id: string) => {
    setMerchants(merchants.map((m) =>
      m.id === id ? { ...m, status: "suspended" as const } : m
    ));
    toast({
      title: "Commerçant suspendu",
      description: "Le commerçant a été suspendu du réseau REV",
      variant: "destructive",
    });
  };

  const handleViewDetails = (id: string) => {
    console.log("View merchant details:", id);
  };

  const handleLogout = () => {
    console.log("Admin logout triggered");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="REV Admin" onLogout={handleLogout} />

      <main className="container max-w-2xl px-4 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Tableau de bord</h2>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble du réseau REV
          </p>
        </div>

        <AdminStats
          totalTransactions={stats.totalTransactions}
          totalMerchants={stats.totalMerchants}
          totalClients={stats.totalClients}
          totalCommissions={stats.totalCommissions}
          transactionGrowth={stats.transactionGrowth}
          merchantGrowth={stats.merchantGrowth}
        />

        <CommissionTracker
          commissions={mockCommissions}
          totalPending={pendingCommissions}
          totalCollected={collectedCommissions}
        />

        <MerchantManagement
          merchants={merchants}
          onValidate={handleValidateMerchant}
          onSuspend={handleSuspendMerchant}
          onViewDetails={handleViewDetails}
        />
      </main>
    </div>
  );
}
