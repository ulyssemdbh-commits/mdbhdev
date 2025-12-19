import { Tag, Store, User, Heart, Gift } from "lucide-react";

export type ClientTab = "bonsplans" | "partrev" | "dons" | "cadeaux" | "compte";

interface BottomNavigationProps {
  activeTab: ClientTab;
  onTabChange: (tab: ClientTab) => void;
}

const tabs = [
  { id: "bonsplans" as const, label: "Bons Plans", icon: Tag },
  { id: "partrev" as const, label: "Boutiques", icon: Store },
  { id: "cadeaux" as const, label: "Cadeaux", icon: Gift },
  { id: "dons" as const, label: "Dons", icon: Heart },
  { id: "compte" as const, label: "Compte", icon: User },
];

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg safe-area-bottom">
      <div className="flex items-stretch max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 px-1 transition-all duration-200 ${
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`nav-tab-${tab.id}`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${isActive ? "bg-primary/10" : ""}`}>
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "font-semibold" : ""}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
