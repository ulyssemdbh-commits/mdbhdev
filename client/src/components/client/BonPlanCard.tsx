import { Tag, Store, Calendar } from "lucide-react";
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
      className="overflow-hidden hover:shadow-md transition-shadow"
      data-testid={`bonplan-card-${bonPlan.id}`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 flex-shrink-0">
              <Tag className="w-5 h-5 text-primary" />
            </div>
            {bonPlan.discount && (
              <Badge className="bg-primary text-primary-foreground font-bold text-sm px-3 py-1.5">
                {bonPlan.discount.replace(/cashback/gi, 'CashBack')}
              </Badge>
            )}
          </div>
          {bonPlan.validUntil && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>Jusqu'au {bonPlan.validUntil}</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-base">{bonPlan.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {bonPlan.description}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Store className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{bonPlan.merchantName}</span>
          <Badge variant="secondary" className="text-xs">
            {bonPlan.category}
          </Badge>
        </div>
        <Button
          className="w-full"
          variant="secondary"
          onClick={onViewOffer}
          data-testid={`button-view-offer-${bonPlan.id}`}
        >
          Voir l'offre
        </Button>
      </CardContent>
    </Card>
  );
}
