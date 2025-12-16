import { Tag, Store, User, Send } from "lucide-react";

export type ClientTab = "bonsplans" | "partrev" | "partager" | "compte";

interface BottomNavigationProps {
  activeTab: ClientTab;
  onTabChange: (tab: ClientTab) => void;
}

const tabs = [
  { id: "bonsplans" as const, label: "Bons Plans", icon: Tag },
  { id: "partrev" as const, label: "Mes boutiques", icon: Store },
  { id: "partager" as const, label: "Partager", icon: Send },
  { id: "compte" as const, label: "Mon Compte", icon: User },
];

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  return (
    <nav className="sticky top-0 z-50 bg-background border-b">
      <div className="flex items-stretch">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
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
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-b-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
