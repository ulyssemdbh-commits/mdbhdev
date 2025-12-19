import { Wallet, Clock } from "lucide-react";
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

  return (
    <Card className="border-card-border bg-primary text-primary-foreground">
      <CardContent className="p-6">
        <h2 className="font-semibold mb-4 text-[#d00000] text-center text-[20px]">Ma cagnotte REV</h2>
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">Disponible</span>
            </div>
            <p className="font-bold text-[24px]" data-testid="text-balance-available">
              {formatCurrency(available)}
            </p>
          </div>
          <div className="w-px h-16 bg-primary-foreground/20" />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">En attente</span>
            </div>
            <p className="text-2xl font-semibold" data-testid="text-balance-pending">
              {formatCurrency(pending)}
            </p>
            {pending > 0 && (
              <p className="text-xs text-primary-foreground/70">
                Disponible le {getReleaseDate()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
