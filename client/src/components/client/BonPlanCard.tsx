import { Tag, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface BonPlan {
  id: string;
  title: string;
  description: string;
  merchantName: string;
  category: string;
  discount?: string;
  validUntil?: string;
}

interface BonPlanCardProps {
  bonPlan: BonPlan;
  onViewOffer?: () => void;
}

export function BonPlanCard({ bonPlan, onViewOffer }: BonPlanCardProps) {
  return (
    <Card
      className="border-card-border overflow-visible"
      data-testid={`bonplan-card-${bonPlan.id}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-amber-100 dark:bg-amber-900/30 flex-shrink-0">
              <Tag className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            {bonPlan.discount && (
              <Badge className="bg-primary text-primary-foreground font-bold" style={{ paddingTop: '11px', paddingBottom: '11px', fontSize: '17px' }}>
                {bonPlan.discount.replace(/cashback/gi, 'CashBack')}
              </Badge>
            )}
          </div>
          {bonPlan.validUntil && (
            <span className="flex-shrink-0 text-[#d00000] text-[15px]">
              Jusqu'au {bonPlan.validUntil}
            </span>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-[#d00000] text-[18px]">{bonPlan.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {bonPlan.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{bonPlan.merchantName}</span>
          <Badge variant="secondary">
            {bonPlan.category}
          </Badge>
        </div>
        <Button
          className="w-full"
          onClick={onViewOffer}
          data-testid={`button-view-offer-${bonPlan.id}`}
        >
          Voir l'offre
        </Button>
      </CardContent>
    </Card>
  );
}
