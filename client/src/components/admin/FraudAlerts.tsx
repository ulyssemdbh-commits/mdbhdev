import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface SuspiciousTransfer {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  reason: string;
  createdAt: string;
}

export function FraudAlerts() {
  const { data: transfers, isLoading } = useQuery<SuspiciousTransfer[]>({
    queryKey: ["/api/admin/suspicious-transfers"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const suspicious = transfers || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Alertes de fraude
        </CardTitle>
        {suspicious.length > 0 && (
          <Badge variant="destructive" className="text-xs">
            {suspicious.length} alertes
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {suspicious.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune activite suspecte detectee
          </p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {suspicious.map((transfer) => (
              <div 
                key={transfer.id}
                className="p-3 bg-red-500/5 border border-red-500/20 rounded-md"
                data-testid={`fraud-alert-${transfer.id}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{transfer.amount.toFixed(2)} EUR</p>
                    <p className="text-xs text-muted-foreground mt-1">{transfer.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(transfer.createdAt), { locale: fr, addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
