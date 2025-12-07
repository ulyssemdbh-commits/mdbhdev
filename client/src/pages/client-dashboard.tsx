import { useState } from "react";
import { Header } from "@/components/shared/Header";
import { QRCodeDisplay } from "@/components/client/QRCodeDisplay";
import { BalanceCard } from "@/components/client/BalanceCard";
import { TransactionList, type Transaction } from "@/components/client/TransactionList";
import { BonPlanCard, type BonPlan } from "@/components/client/BonPlanCard";
import { MerchantCard, type Merchant } from "@/components/client/MerchantCard";
import { MerchantFilters, type CategoryFilter } from "@/components/client/MerchantFilters";
import { BottomNavigation, type ClientTab } from "@/components/client/BottomNavigation";
import { ScrollArea } from "@/components/ui/scroll-area";

// todo: remove mock functionality
const mockTransactions: Transaction[] = [
  { id: "1", merchantName: "Boulangerie Antoine", amount: 2.0, status: "pending", date: "Aujourd'hui, 10:32" },
  { id: "2", merchantName: "Café Marcel", amount: 3.0, status: "used", date: "Hier, 14:15" },
  { id: "3", merchantName: "Supermarché Bio", amount: 5.4, status: "earned", date: "5 déc., 18:45" },
  { id: "4", merchantName: "Pharmacie Centrale", amount: 1.2, status: "earned", date: "3 déc., 09:20" },
];

// todo: remove mock functionality
const mockBonsPlans: BonPlan[] = [
  { id: "1", title: "-20% sur les viennoiseries", description: "Profitez de 20% de réduction sur toutes les viennoiseries du matin", merchantName: "Boulangerie Antoine", category: "Alimentation", discount: "-20%", validUntil: "31 déc." },
  { id: "2", title: "Café offert", description: "Un café offert pour tout achat d'un petit-déjeuner complet", merchantName: "Café Marcel", category: "Restauration", discount: "Offert", validUntil: "15 déc." },
  { id: "3", title: "-10% sur les produits frais", description: "Réduction sur tous les fruits et légumes de saison", merchantName: "Supermarché Bio", category: "Alimentation", discount: "-10%", validUntil: "20 déc." },
];

// todo: remove mock functionality
const mockMerchants: Merchant[] = [
  { id: "1", name: "Boulangerie Antoine", category: "Alimentation", address: "12 rue du Commerce", distance: "150m", visited: true, hasBonsPlan: true },
  { id: "2", name: "Café Marcel", category: "Restauration", address: "5 place de la Mairie", distance: "200m", visited: true, hasBonsPlan: true },
  { id: "3", name: "Supermarché Bio", category: "Alimentation", address: "28 avenue Jean Jaurès", distance: "350m", visited: false, hasBonsPlan: true },
  { id: "4", name: "Pharmacie Centrale", category: "Santé", address: "1 rue de la Santé", distance: "100m", visited: true },
  { id: "5", name: "Fleuriste Rose", category: "Services", address: "15 rue des Fleurs", distance: "400m", visited: false },
  { id: "6", name: "Librairie du Coin", category: "Services", address: "8 rue Victor Hugo", distance: "250m", visited: true },
];

export default function ClientDashboard() {
  const [activeTab, setActiveTab] = useState<ClientTab>("compte");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [bonsPlansSearchQuery, setBonsPlansSearchQuery] = useState("");
  const [bonsPlansCategory, setBonsPlansCategory] = useState<CategoryFilter>("all");

  // todo: remove mock functionality
  const clientId = "CLT-7X9K2M";
  const clientName = "Marie Dupont";
  const availableBalance = 12.40;
  const pendingBalance = 2.00;

  const filteredMerchants = mockMerchants.filter((m) => {
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

  const handleLogout = () => {
    console.log("Logout triggered");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="REV" onLogout={handleLogout} />

      <main className="container max-w-lg px-4 py-6">
        {activeTab === "compte" && (
          <div className="space-y-6">
            <QRCodeDisplay clientId={clientId} clientName={clientName} />
            <BalanceCard available={availableBalance} pending={pendingBalance} />
            <TransactionList transactions={mockTransactions} />
          </div>
        )}

        {activeTab === "bonsplans" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Bons Plans</h2>
            <p className="text-sm text-muted-foreground">
              Découvrez les offres exclusives de nos commerçants partenaires
            </p>
            <MerchantFilters
              searchQuery={bonsPlansSearchQuery}
              onSearchChange={setBonsPlansSearchQuery}
              activeCategory={bonsPlansCategory}
              onCategoryChange={setBonsPlansCategory}
            />
            <div className="space-y-4">
              {filteredBonsPlans.length > 0 ? (
                filteredBonsPlans.map((bp) => (
                  <BonPlanCard
                    key={bp.id}
                    bonPlan={bp}
                    onViewOffer={() => console.log("View offer:", bp.id)}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Aucun bon plan trouvé pour cette recherche
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "partrev" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Mes partREV</h2>
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
            <div className="space-y-3">
              {filteredMerchants.map((merchant) => (
                <MerchantCard
                  key={merchant.id}
                  merchant={merchant}
                  onClick={() => console.log("View merchant:", merchant.id)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
