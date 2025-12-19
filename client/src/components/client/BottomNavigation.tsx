import { Tag, Store, User, Heart } from "lucide-react";

export type ClientTab = "bonsplans" | "partrev" | "dons" | "compte";

interface BottomNavigationProps {
  activeTab: ClientTab;
  onTabChange: (tab: ClientTab) => void;
}

const tabs = [
  { id: "bonsplans" as const, label: "Bons Plans", icon: Tag },
  { id: "partrev" as const, label: "Boutiques", icon: Store },
  { id: "dons" as const, label: "Dons", icon: Heart },
  { id: "compte" as const, label: "Compte", icon: User },
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
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors hover-elevate bg-[#f5f5f5] text-[#0d0d0d] pt-[5px] pb-[5px]"
              data-testid={`nav-tab-${tab.id}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
              <span className="text-xs font-semibold text-[#090909]">
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
