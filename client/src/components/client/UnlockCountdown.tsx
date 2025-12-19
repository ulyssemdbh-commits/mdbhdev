import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Unlock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import type { CashbackEntry } from "@shared/schema";

export function UnlockCountdown() {
  const { data: pendingEntries, isLoading } = useQuery<CashbackEntry[]>({
    queryKey: ["/api/cashback/pending-entries"],
  });

  if (isLoading || !pendingEntries || pendingEntries.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Cashback en attente de deblocage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingEntries.map((entry) => {
          const unlocksAt = new Date(entry.unlocksAt);
          const isUnlocked = unlocksAt <= new Date();
          const timeLeft = formatDistanceToNow(unlocksAt, { locale: fr, addSuffix: true });
          
          return (
            <div 
              key={entry.id} 
              className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
              data-testid={`pending-entry-${entry.id}`}
            >
              <div className="flex items-center gap-3">
                {isUnlocked ? (
                  <Unlock className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500" />
                )}
                <div>
                  <p className="font-medium">{parseFloat(entry.amount).toFixed(2)} EUR</p>
                  <p className="text-xs text-muted-foreground">
                    {isUnlocked ? "Pret a utiliser" : `Disponible ${timeLeft}`}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
