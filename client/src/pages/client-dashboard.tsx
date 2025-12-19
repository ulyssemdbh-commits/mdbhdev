import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/shared/Header";
import { AccountSection } from "@/components/shared/AccountSection";
import { QRCodeDisplay } from "@/components/client/QRCodeDisplay";
import { BalanceCard } from "@/components/client/BalanceCard";
import { TransactionList, type Transaction } from "@/components/client/TransactionList";
import { BonPlanCard, type BonPlan } from "@/components/client/BonPlanCard";
import { MerchantCard, type Merchant } from "@/components/client/MerchantCard";
import { MerchantFilters } from "@/components/client/MerchantFilters";
import { BottomNavigation, type ClientTab } from "@/components/client/BottomNavigation";
import { CashbackTransfer } from "@/components/client/CashbackTransfer";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Tag, Store, Calendar, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharityDonation } from "@/components/client/CharityDonation";
import type { User, Merchant as APIMerchant, CashbackBalance, Promotion } from "@shared/schema";

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

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState<ClientTab>("compte");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bonsPlansSearchQuery, setBonsPlansSearchQuery] = useState("");
  const [bonsPlansCategory, setBonsPlansCategory] = useState<string>("all");
  const [selectedOffer, setSelectedOffer] = useState<BonPlan | null>(null);

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

  const { data: promotionsRaw, isLoading: promotionsLoading } = useQuery<(Promotion & { merchantName: string; merchantCategory: string })[] | null>({
    queryKey: ["/api/promotions"],
  });
  const promotionsData = promotionsRaw || [];

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

  // Get unique categories used by merchants
  const usedCategories = useMemo(() => {
    const categories = new Set(merchants.map(m => m.category));
    return Array.from(categories);
  }, [merchants]);

  // Transform promotions to BonPlan format
  const bonsPlans: BonPlan[] = useMemo(() => {
    return promotionsData.map((promo) => {
      const merchant = merchants.find(m => m.id === promo.merchantId);
      let discount = "";
      if (promo.type === "cashback_boost") {
        discount = `${promo.cashbackBoostRate}% cashback`;
      } else if (promo.type === "free_article") {
        discount = "Offert";
      } else if (promo.type === "discount_percent") {
        discount = `-${promo.discountPercent}%`;
      }
      return {
        id: promo.id,
        title: promo.title,
        description: promo.description || (promo.type === "free_article" ? promo.freeArticle || "" : ""),
        merchantName: merchant?.name || promo.merchantName || "Commerçant",
        category: merchant?.category || promo.merchantCategory || "Commerce",
        discount,
        validUntil: new Date(promo.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
      };
    });
  }, [promotionsData, merchants]);

  const filteredMerchants = displayMerchants.filter((m) => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || m.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredBonsPlans = bonsPlans.filter((bp) => {
    const matchesSearch = bp.title.toLowerCase().includes(bonsPlansSearchQuery.toLowerCase()) ||
      bp.merchantName.toLowerCase().includes(bonsPlansSearchQuery.toLowerCase());
    const matchesCategory = bonsPlansCategory === "all" || bp.category === bonsPlansCategory;
    return matchesSearch && matchesCategory;
  });

  const clientName = typedUser
    ? (typedUser.firstName && typedUser.lastName 
        ? `${typedUser.firstName} ${typedUser.lastName.charAt(0).toUpperCase()}.`
        : typedUser.firstName || typedUser.email || "Client")
    : "Client";

  const clientRevId = typedUser?.revId || "REVid-000000";

  const isLoading = merchantsLoading || balancesLoading || transactionsLoading || promotionsLoading;

  return (
    <div className="min-h-screen bg-background">
      <Header title="REV" />
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="container max-w-lg px-4 py-6 pb-24">
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
                <QRCodeDisplay revId={clientRevId} clientName={clientName} />
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
              <motion.div variants={fadeInUp}>
                <CashbackTransfer />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <AccountSection user={typedUser || null} />
              </motion.div>
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
                usedCategories={usedCategories}
              />
              <motion.h2 variants={fadeInUp} className="text-xl font-bold">Bons Plans</motion.h2>
              <p className="text-sm text-muted-foreground">
                Découvrez les offres exclusives de nos commerçants partenaires
              </p>
              {promotionsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
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
                          onViewOffer={() => setSelectedOffer(bp)}
                        />
                      </motion.div>
                    ))
                  ) : bonsPlans.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Aucune offre disponible pour le moment
                    </p>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Aucun bon plan trouvé pour cette recherche
                    </p>
                  )}
                </motion.div>
              )}
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
                usedCategories={usedCategories}
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

          {activeTab === "dons" && (
            <motion.div
              key="dons"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={fadeInUp}
              transition={{ duration: 0.2 }}
            >
              <CharityDonation onBack={() => setActiveTab("compte")} />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <Dialog open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Détails de l'offre
            </DialogTitle>
          </DialogHeader>
          {selectedOffer && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-md bg-amber-100 dark:bg-amber-900/30">
                  <Tag className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedOffer.title}</h3>
                  {selectedOffer.discount && (
                    <Badge className="bg-primary text-primary-foreground mt-1">
                      {selectedOffer.discount}
                    </Badge>
                  )}
                </div>
              </div>

              <p className="text-muted-foreground">{selectedOffer.description}</p>

              <div className="flex items-center gap-2 text-sm">
                <Store className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{selectedOffer.merchantName}</span>
                <Badge variant="secondary">{selectedOffer.category}</Badge>
              </div>

              {selectedOffer.validUntil && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Valable jusqu'au {selectedOffer.validUntil}</span>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Rendez-vous chez le commerçant et présentez votre code QR pour profiter de cette offre.
                </p>
              </div>

              <Button 
                className="w-full" 
                onClick={() => setSelectedOffer(null)}
                data-testid="button-close-offer-dialog"
              >
                Fermer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
