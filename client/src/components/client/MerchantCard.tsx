import { MapPin, Check, Store, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserFavorite } from "@shared/schema";

export interface Merchant {
  id: string;
  name: string;
  category: string;
  address: string;
  distance?: string;
  visited?: boolean;
  hasBonsPlan?: boolean;
}

interface MerchantCardProps {
  merchant: Merchant;
  onClick?: () => void;
  showFavorite?: boolean;
}

export function MerchantCard({ merchant, onClick, showFavorite = true }: MerchantCardProps) {
  const { data: favorites } = useQuery<UserFavorite[]>({
    queryKey: ["/api/favorites"],
  });
  
  const isFavorite = favorites?.some(f => f.merchantId === merchant.id) || false;
  
  const addFavorite = useMutation({
    mutationFn: () => apiRequest("POST", `/api/favorites/${merchant.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }),
  });
  
  const removeFavorite = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/favorites/${merchant.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/favorites"] }),
  });
  
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFavorite) {
      removeFavorite.mutate();
    } else {
      addFavorite.mutate();
    }
  };

  return (
    <Card
      className="border-card-border hover-elevate active-elevate-2 cursor-pointer"
      onClick={onClick}
      data-testid={`merchant-card-${merchant.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-md bg-muted flex-shrink-0">
            <Store className="w-6 h-6 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h3 className="font-semibold truncate">{merchant.name}</h3>
                {merchant.visited && (
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
              </div>
              {showFavorite && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={handleFavoriteClick}
                  data-testid={`favorite-button-${merchant.id}`}
                >
                  <Heart 
                    className={`w-4 h-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
                  />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                {merchant.category}
              </Badge>
              {merchant.hasBonsPlan && (
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  Bon Plan
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span className="truncate">{merchant.address}</span>
              {merchant.distance && (
                <>
                  <span className="mx-1">•</span>
                  <span className="flex-shrink-0">{merchant.distance}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
