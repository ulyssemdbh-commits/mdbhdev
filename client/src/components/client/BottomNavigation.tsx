import { Tag, Store, User } from "lucide-react";

export type ClientTab = "bonsplans" | "partrev" | "compte";

interface BottomNavigationProps {
  activeTab: ClientTab;
  onTabChange: (tab: ClientTab) => void;
}

const tabs = [
  { id: "bonsplans" as const, label: "Bons Plans", icon: Tag },
  { id: "partrev" as const, label: "Mes partREV", icon: Store },
  { id: "compte" as const, label: "Mon Compte", icon: User },
];

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-pb">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover-elevate"
              }`}
              data-testid={`nav-tab-${tab.id}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
              <span className={`text-xs ${isActive ? "font-semibold" : "font-medium"}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
