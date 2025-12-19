import { Wallet, Clock, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format, addBusinessDays } from "date-fns";
import { fr } from "date-fns/locale";

interface BalanceCardProps {
  available: number;
  pending: number;
  pendingUnlockDays?: number;
}

export function BalanceCard({ available, pending, pendingUnlockDays = 7 }: BalanceCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const getReleaseDate = () => {
    const releaseDate = addBusinessDays(new Date(), pendingUnlockDays);
    return format(releaseDate, "d MMMM", { locale: fr });
  };

  const total = available + pending;

  return (
    <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-primary-foreground/20 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Ma Cagnotte REV</h2>
              <p className="text-xs text-primary-foreground/70">Votre CashBack cumule</p>
            </div>
          </div>
          
          <div className="text-center mb-4">
            <p className="text-4xl font-bold tracking-tight" data-testid="text-balance-total">
              {formatCurrency(total)}
            </p>
            <p className="text-sm text-primary-foreground/70 mt-1">Total CashBack</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 bg-primary-foreground/10 backdrop-blur-sm">
          <div className="p-4 border-r border-primary-foreground/20">
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-1">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-medium">Disponible</span>
            </div>
            <p className="text-xl font-bold" data-testid="text-balance-available">
              {formatCurrency(available)}
            </p>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">En attente</span>
            </div>
            <p className="text-xl font-semibold" data-testid="text-balance-pending">
              {formatCurrency(pending)}
            </p>
            {pending > 0 && (
              <p className="text-[10px] text-primary-foreground/60 mt-0.5">
                Dispo. le {getReleaseDate()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
