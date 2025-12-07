import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type CategoryFilter = "all" | "alimentation" | "sante" | "services" | "restauration" | "mode";

interface MerchantFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  onProximitySort?: () => void;
}

const categories = [
  { id: "all" as const, label: "Tous" },
  { id: "alimentation" as const, label: "Alimentation" },
  { id: "sante" as const, label: "Santé" },
  { id: "restauration" as const, label: "Restauration" },
  { id: "services" as const, label: "Services" },
  { id: "mode" as const, label: "Mode" },
];

export function MerchantFilters({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  onProximitySort,
}: MerchantFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher un commerçant..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-merchant-search"
        />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant={activeCategory === cat.id ? "default" : "secondary"}
            onClick={() => onCategoryChange(cat.id)}
            className="flex-shrink-0"
            data-testid={`filter-category-${cat.id}`}
          >
            {cat.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="outline"
          onClick={onProximitySort}
          className="flex-shrink-0 gap-1"
          data-testid="button-proximity-sort"
        >
          <MapPin className="w-3 h-3" />
          À proximité
        </Button>
      </div>
    </div>
  );
}
