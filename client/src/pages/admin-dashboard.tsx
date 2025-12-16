import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/shared/Header";
import { AdminStats } from "@/components/admin/AdminStats";
import { MerchantManagement, type AdminMerchant } from "@/components/admin/MerchantManagement";
import { CommissionTracker, type WeeklyCommission } from "@/components/admin/CommissionTracker";
import { AddMerchantDialog } from "@/components/admin/AddMerchantDialog";
import { EditMerchantDialog } from "@/components/admin/EditMerchantDialog";
import { DeleteMerchantDialog } from "@/components/admin/DeleteMerchantDialog";
import { MerchantDetailsDialog } from "@/components/admin/MerchantDetailsDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import type { Merchant, Transaction } from "@shared/schema";

interface AdminStatsData {
  totalTransactions: number;
  totalMerchants: number;
  totalClients: number;
  totalCommissions: number;
  totalSales: number;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [deletingMerchant, setDeletingMerchant] = useState<Merchant | null>(null);
  const [viewingMerchantId, setViewingMerchantId] = useState<string | null>(null);

  const { data: statsRaw, isLoading: statsLoading } = useQuery<AdminStatsData | null>({
    queryKey: ["/api/admin/stats"],
  });
  const stats = statsRaw || {
    totalTransactions: 0,
    totalMerchants: 0,
    totalClients: 0,
    totalCommissions: 0,
    totalSales: 0,
  };

  const { data: merchantsRaw = [], isLoading: merchantsLoading } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
  });
  const merchants = merchantsRaw || [];

  const { data: transactionsRaw = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
  });
  const allTransactions = transactionsRaw || [];

  const updateMerchantMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Merchant> }) => {
      return apiRequest("PATCH", `/api/admin/merchants/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditingMerchant(null);
    },
  });

  const deleteMerchantMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/merchants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeletingMerchant(null);
      toast({
        title: "Commerçant supprimé",
        description: "Le commerçant a été supprimé définitivement",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le commerçant",
        variant: "destructive",
      });
    },
  });

  const createMerchantMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      category: string;
      address: string;
      phone?: string;
      email?: string;
      siret?: string;
      contactName?: string;
      bankIban?: string;
      bankBic?: string;
    }) => {
      return apiRequest("POST", "/api/admin/merchants", {
        name: data.name,
        description: data.description || "",
        category: data.category,
        address: data.address,
        phone: data.phone || null,
        email: data.email || null,
        siret: data.siret || null,
        contactName: data.contactName || null,
        bankIban: data.bankIban || null,
        bankBic: data.bankBic || null,
        isActive: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Commerçant ajouté",
        description: "Le nouveau commerçant a été ajouté avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter le commerçant",
        variant: "destructive",
      });
    },
  });

  // Transform merchants for display
  const adminMerchants: AdminMerchant[] = merchants.map((m) => {
    const merchantTxs = allTransactions.filter(
      (tx) => tx.merchantId === m.id && tx.status === "completed"
    );
    const totalSales = merchantTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

    return {
      id: m.id,
      name: m.name,
      status: m.isActive ? "active" : "pending",
      joinDate: new Date(m.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      totalSales,
      hasBonsPlanPack: false,
    };
  });

  // Generate chart data from transactions
  const chartData = generateChartData(allTransactions);
  const merchantChartData = generateMerchantChartData(merchants, allTransactions);

  // Calculate commissions from transactions
  const commissions: WeeklyCommission[] = generateCommissions(allTransactions, merchants);
  const pendingCommissions = commissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + c.commission, 0);
  const collectedCommissions = commissions
    .filter((c) => c.status === "collected")
    .reduce((sum, c) => sum + c.commission, 0);

  const handleValidateMerchant = async (id: string) => {
    try {
      await updateMerchantMutation.mutateAsync({ id, data: { isActive: true } });
      toast({
        title: "Commerçant validé",
        description: "Le commerçant a été activé et peut maintenant utiliser REV",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de valider le commerçant",
        variant: "destructive",
      });
    }
  };

  const handleSuspendMerchant = async (id: string) => {
    try {
      await updateMerchantMutation.mutateAsync({ id, data: { isActive: false } });
      toast({
        title: "Commerçant suspendu",
        description: "Le commerçant a été suspendu du réseau REV",
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de suspendre le commerçant",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (id: string) => {
    setViewingMerchantId(id);
  };

  const handleEditMerchant = (id: string) => {
    const merchant = merchants.find((m) => m.id === id);
    if (merchant) {
      setEditingMerchant(merchant);
    }
  };

  const handleDeleteMerchant = (id: string) => {
    const merchant = merchants.find((m) => m.id === id);
    if (merchant) {
      setDeletingMerchant(merchant);
    }
  };

  const handleSaveEdit = async (id: string, data: Partial<Merchant>) => {
    try {
      await updateMerchantMutation.mutateAsync({ id, data });
      toast({
        title: "Modifications enregistrées",
        description: "Les informations du commerçant ont été mises à jour",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les modifications",
        variant: "destructive",
      });
    }
  };

  const isLoading = statsLoading || merchantsLoading || txLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header title="REV Admin" />

      <main className="container max-w-4xl px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Tableau de bord</h2>
            <p className="text-sm text-muted-foreground">
              Vue d'ensemble du réseau REV
            </p>
          </div>
          <AddMerchantDialog
            onSubmit={async (data) => {
              await createMerchantMutation.mutateAsync(data);
            }}
            isLoading={createMerchantMutation.isPending}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <AdminStats
              totalTransactions={stats.totalTransactions}
              totalMerchants={stats.totalMerchants}
              totalClients={stats.totalClients}
              totalCommissions={stats.totalCommissions}
              transactionGrowth={0}
              merchantGrowth={0}
            />

            {chartData.length > 0 && (
              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Évolution du chiffre d'affaires</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => [`${value.toFixed(2)} €`, 'CA']}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="sales" 
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary) / 0.2)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {merchantChartData.length > 0 && (
              <Card className="border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">CA par commerçant</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={merchantChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => [`${value.toFixed(2)} €`, 'CA']}
                        />
                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <CommissionTracker
              commissions={commissions}
              totalPending={pendingCommissions}
              totalCollected={collectedCommissions}
            />

            <MerchantManagement
              merchants={adminMerchants}
              onValidate={handleValidateMerchant}
              onSuspend={handleSuspendMerchant}
              onViewDetails={handleViewDetails}
              onEdit={handleEditMerchant}
              onDelete={handleDeleteMerchant}
            />
          </>
        )}
      </main>

      <EditMerchantDialog
        merchant={editingMerchant}
        open={!!editingMerchant}
        onOpenChange={(open) => !open && setEditingMerchant(null)}
        onSave={handleSaveEdit}
        isPending={updateMerchantMutation.isPending}
      />

      <DeleteMerchantDialog
        merchantName={deletingMerchant?.name || ""}
        open={!!deletingMerchant}
        onOpenChange={(open) => !open && setDeletingMerchant(null)}
        onConfirm={() => deletingMerchant && deleteMerchantMutation.mutate(deletingMerchant.id)}
        isPending={deleteMerchantMutation.isPending}
      />

      <MerchantDetailsDialog
        merchantId={viewingMerchantId}
        open={!!viewingMerchantId}
        onOpenChange={(open) => !open && setViewingMerchantId(null)}
      />
    </div>
  );
}

function generateChartData(transactions: Transaction[]) {
  const completed = transactions.filter((tx) => tx.status === "completed");
  if (completed.length === 0) return [];

  const byDate: Record<string, number> = {};
  completed.forEach((tx) => {
    const date = new Date(tx.createdAt).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
    byDate[date] = (byDate[date] || 0) + parseFloat(tx.amount);
  });

  return Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([date, sales]) => ({ date, sales }));
}

function generateMerchantChartData(merchants: Merchant[], transactions: Transaction[]) {
  return merchants
    .map((m) => {
      const merchantTxs = transactions.filter(
        (tx) => tx.merchantId === m.id && tx.status === "completed"
      );
      const sales = merchantTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      return { name: m.name.slice(0, 15), sales };
    })
    .filter((m) => m.sales > 0)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);
}

function generateCommissions(transactions: Transaction[], merchants: Merchant[]): WeeklyCommission[] {
  const completed = transactions.filter((tx) => tx.status === "completed");
  if (completed.length === 0) return [];

  const now = new Date();
  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const byMerchant: Record<string, { sales: number; commission: number }> = {};
  
  completed.forEach((tx) => {
    if (!byMerchant[tx.merchantId]) {
      byMerchant[tx.merchantId] = { sales: 0, commission: 0 };
    }
    byMerchant[tx.merchantId].sales += parseFloat(tx.amount);
    byMerchant[tx.merchantId].commission += parseFloat(tx.commissionAmount);
  });

  return Object.entries(byMerchant).map(([merchantId, data]) => {
    const merchant = merchants.find((m) => m.id === merchantId);
    return {
      merchantId,
      merchantName: merchant?.name || "Commerçant",
      weekLabel: "Cette semaine",
      totalSales: data.sales,
      commission: data.commission,
      status: "pending" as const,
    };
  });
}
