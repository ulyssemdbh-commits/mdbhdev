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
          variant="secondary"
          onClick={() => onCategoryChange("all")}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2 border [border-color:var(--button-outline)] shadow-xs active:shadow-none min-h-9 px-4 py-2 w-full gap-2 font-bold text-[20px] text-[#000000] bg-[#f5f5f5]"
          data-testid="filter-category-all"
        >
          Tous
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            size="sm"
            variant="secondary"
            onClick={() => onCategoryChange(cat.name)}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2 border [border-color:var(--button-outline)] shadow-xs active:shadow-none min-h-9 px-4 py-2 w-full gap-2 font-bold text-[20px] text-[#000000] bg-[#f5f5f5]"
            data-testid={`filter-category-${cat.id}`}
          >
            {cat.name}
          </Button>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={onProximitySort}
          className="flex-shrink-0 gap-1 font-bold bg-[#f5f5f5] text-[#000000]"
          data-testid="button-proximity-sort"
        >
          <MapPin className="w-3 h-3" />
          À proximité
        </Button>
      </div>
    </div>
  );
}
