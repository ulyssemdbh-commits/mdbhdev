import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/shared/Header";
import { QRCodeDisplay } from "@/components/client/QRCodeDisplay";
import { BalanceCard } from "@/components/client/BalanceCard";
import { TransactionList, type Transaction } from "@/components/client/TransactionList";
import { BonPlanCard, type BonPlan } from "@/components/client/BonPlanCard";
import { MerchantCard, type Merchant } from "@/components/client/MerchantCard";
import { MerchantFilters, type CategoryFilter } from "@/components/client/MerchantFilters";
import { BottomNavigation, type ClientTab } from "@/components/client/BottomNavigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import type { User, Merchant as APIMerchant, CashbackBalance } from "@shared/schema";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const staggerChildren = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// todo: remove mock functionality for bons plans
const mockBonsPlans: BonPlan[] = [
  { id: "1", title: "-20% sur les viennoiseries", description: "Profitez de 20% de réduction sur toutes les viennoiseries du matin", merchantName: "Boulangerie Antoine", category: "Alimentation", discount: "-20%", validUntil: "31 déc." },
  { id: "2", title: "Café offert", description: "Un café offert pour tout achat d'un petit-déjeuner complet", merchantName: "Café Marcel", category: "Restauration", discount: "Offert", validUntil: "15 déc." },
  { id: "3", title: "-10% sur les produits frais", description: "Réduction sur tous les fruits et légumes de saison", merchantName: "Supermarché Bio", category: "Alimentation", discount: "-10%", validUntil: "20 déc." },
];

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState<ClientTab>("compte");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [bonsPlansSearchQuery, setBonsPlansSearchQuery] = useState("");
  const [bonsPlansCategory, setBonsPlansCategory] = useState<CategoryFilter>("all");

  const { user } = useAuth();
  const typedUser = user as User | undefined;

  const { data: merchantsRaw, isLoading: merchantsLoading } = useQuery<APIMerchant[] | null>({
    queryKey: ["/api/merchants"],
  });
  const merchants = merchantsRaw || [];

  const { data: cashbackBalancesRaw, isLoading: balancesLoading } = useQuery<CashbackBalance[] | null>({
    queryKey: ["/api/cashback/balances"],
  });
  const cashbackBalances = cashbackBalancesRaw || [];

  const { data: transactionsRaw, isLoading: transactionsLoading } = useQuery<any[] | null>({
    queryKey: ["/api/transactions/client"],
  });
  const transactionsData = transactionsRaw || [];

  // Calculate total balances
  const availableBalance = cashbackBalances.reduce(
    (sum, b) => sum + parseFloat(b.availableBalance || "0"),
    0
  );
  const pendingBalance = cashbackBalances.reduce(
    (sum, b) => sum + parseFloat(b.pendingBalance || "0"),
    0
  );

  // Transform API transactions to display format
  const transactions: Transaction[] = transactionsData.map((tx: any) => {
    const merchant = merchants.find((m) => m.id === tx.merchantId);
    const cashbackAmount = parseFloat(tx.cashbackAmount || "0");
    
    // Determine status: pending (7-day lock), earned (available), used (spent), cancelled
    let displayStatus: "pending" | "earned" | "used";
    if (tx.status === "cancelled") {
      displayStatus = "used";
    } else if (tx.status === "pending") {
      displayStatus = "pending";
    } else {
      displayStatus = "earned";
    }

    return {
      id: tx.id,
      merchantName: merchant?.name || "Commerçant",
      amount: cashbackAmount,
      status: displayStatus,
      date: new Date(tx.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  // Transform merchants for display
  const displayMerchants: Merchant[] = merchants.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    address: m.address || "",
    distance: "",
    visited: false,
    hasBonsPlan: false,
  }));

  const filteredMerchants = displayMerchants.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || m.category.toLowerCase() === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredBonsPlans = mockBonsPlans.filter((bp) => {
    const matchesSearch = bp.title.toLowerCase().includes(bonsPlansSearchQuery.toLowerCase()) ||
      bp.merchantName.toLowerCase().includes(bonsPlansSearchQuery.toLowerCase());
    const matchesCategory = bonsPlansCategory === "all" || bp.category.toLowerCase() === bonsPlansCategory;
    return matchesSearch && matchesCategory;
  });

  const clientName = typedUser
    ? `${typedUser.firstName || ""} ${typedUser.lastName || ""}`.trim() || typedUser.email || "Client"
    : "Client";

  const clientId = typedUser?.id || "CLT-UNKNOWN";

  const isLoading = merchantsLoading || balancesLoading || transactionsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header title="REV" />
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="container max-w-lg px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "compte" && (
            <motion.div
              key="compte"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={fadeInUp}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <motion.div variants={fadeInUp}>
                <QRCodeDisplay clientId={clientId} clientName={clientName} />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <BalanceCard available={availableBalance} pending={pendingBalance} />
              </motion.div>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <motion.div variants={fadeInUp}>
                  <TransactionList transactions={transactions} />
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === "bonsplans" && (
            <motion.div
              key="bonsplans"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={fadeInUp}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <MerchantFilters
                searchQuery={bonsPlansSearchQuery}
                onSearchChange={setBonsPlansSearchQuery}
                activeCategory={bonsPlansCategory}
                onCategoryChange={setBonsPlansCategory}
              />
              <motion.h2 variants={fadeInUp} className="text-xl font-bold">Bons Plans</motion.h2>
              <p className="text-sm text-muted-foreground">
                Découvrez les offres exclusives de nos commerçants partenaires
              </p>
              <motion.div variants={staggerChildren} className="space-y-4">
                {filteredBonsPlans.length > 0 ? (
                  filteredBonsPlans.map((bp, index) => (
                    <motion.div
                      key={bp.id}
                      variants={fadeInUp}
                      transition={{ delay: index * 0.05 }}
                    >
                      <BonPlanCard
                        bonPlan={bp}
                        onViewOffer={() => console.log("View offer:", bp.id)}
                      />
                    </motion.div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun bon plan trouvé pour cette recherche
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}

          {activeTab === "partrev" && (
            <motion.div
              key="partrev"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={fadeInUp}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <motion.h2 variants={fadeInUp} className="text-xl font-bold">Mes partREV</motion.h2>
              <p className="text-sm text-muted-foreground">
                Les commerçants partenaires où gagner du cashback
              </p>
              <MerchantFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeCategory={categoryFilter}
                onCategoryChange={setCategoryFilter}
                onProximitySort={() => console.log("Sort by proximity")}
              />
              {merchantsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <motion.div variants={staggerChildren} className="space-y-3">
                  {filteredMerchants.length > 0 ? (
                    filteredMerchants.map((merchant, index) => (
                      <motion.div
                        key={merchant.id}
                        variants={fadeInUp}
                        transition={{ delay: index * 0.05 }}
                      >
                        <MerchantCard
                          merchant={merchant}
                          onClick={() => console.log("View merchant:", merchant.id)}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun commerçant trouvé
                    </p>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
