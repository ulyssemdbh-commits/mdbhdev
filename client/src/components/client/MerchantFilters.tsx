import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";

interface Category {
  id: number;
  name: string;
  description: string | null;
}

interface MerchantFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  onProximitySort?: () => void;
  usedCategories?: string[];
}

export function MerchantFilters({
  searchQuery,
  onSearchChange,
  activeCategory,
  onCategoryChange,
  onProximitySort,
  usedCategories,
}: MerchantFiltersProps) {
  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ['/api/merchant-categories'],
  });

  const categories = usedCategories 
    ? allCategories.filter(cat => usedCategories.includes(cat.name))
    : allCategories;

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
        <Button
          size="sm"
          variant={activeCategory === "all" ? "default" : "secondary"}
          onClick={() => onCategoryChange("all")}
          className={activeCategory === "all" ? "flex-shrink-0" : "flex-shrink-0 bg-[#f5f5f5] text-[#000000] text-[18px] py-[5px] font-bold"}
          data-testid="filter-category-all"
        >
          Tous
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant={activeCategory === cat.name ? "default" : "secondary"}
            onClick={() => onCategoryChange(cat.name)}
            className={activeCategory === cat.name ? "flex-shrink-0" : "flex-shrink-0 bg-[#f5f5f5] text-[#000000] text-[18px] py-[5px] font-bold"}
            data-testid={`filter-category-${cat.id}`}
          >
            {cat.name}
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
