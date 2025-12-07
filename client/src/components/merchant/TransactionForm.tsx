import { useState } from "react";
import { User, Euro, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TransactionFormProps {
  clientId: string;
  clientName?: string;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
}

export function TransactionForm({
  clientId,
  clientName,
  onSubmit,
  onCancel,
}: TransactionFormProps) {
  const [amount, setAmount] = useState("");

  const numericAmount = parseFloat(amount) || 0;
  const cashbackAmount = numericAmount * 0.1;
  const commissionAmount = numericAmount * 0.13;

  const handleSubmit = () => {
    if (numericAmount > 0) {
      onSubmit(numericAmount);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Nouvelle transaction</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary">
            <User className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-medium">{clientName || "Client REV"}</p>
            <p className="text-sm text-muted-foreground">{clientId}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Montant de l'achat</label>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-4xl font-bold h-20 pr-12 text-center"
              data-testid="input-transaction-amount"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
              <Euro className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
        </div>

        {numericAmount > 0 && (
          <div className="space-y-2 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cashback client (10%)</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-cashback-preview">
                +{formatCurrency(cashbackAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Commission REV (13%)</span>
              <span>{formatCurrency(commissionAmount)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={onCancel}
            data-testid="button-cancel-transaction"
          >
            <X className="w-4 h-4" />
            Annuler
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={numericAmount <= 0}
            data-testid="button-validate-transaction"
          >
            <Check className="w-4 h-4" />
            Valider
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
