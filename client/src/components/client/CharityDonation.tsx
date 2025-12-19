import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heart, ArrowLeft, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Charity, CashbackBalance, Merchant } from "@shared/schema";

interface CharityDonationProps {
  onBack: () => void;
}

const categoryLabels: Record<string, string> = {
  social: "Solidarité",
  environnement: "Environnement",
  sante: "Santé",
  animaux: "Animaux",
  enfance: "Enfance",
  education: "Éducation",
};

export function CharityDonation({ onBack }: CharityDonationProps) {
  const { toast } = useToast();
  const [selectedCharity, setSelectedCharity] = useState<Charity | null>(null);
  const [donationDialogOpen, setDonationDialogOpen] = useState(false);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [donationAmount, setDonationAmount] = useState<string>("");
  const [donationSuccess, setDonationSuccess] = useState(false);

  const { data: charities, isLoading: charitiesLoading } = useQuery<Charity[]>({
    queryKey: ["/api/charities"],
  });

  const { data: balances } = useQuery<CashbackBalance[]>({
    queryKey: ["/api/cashback/balances"],
  });

  const { data: merchants } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
  });

  const availableBalances = (balances || []).filter(
    (b) => parseFloat(b.availableBalance) > 0
  );

  const getMerchantName = (merchantId: string) => {
    const merchant = merchants?.find((m) => m.id === merchantId);
    return merchant?.name || "Commerce";
  };

  const getSelectedBalance = () => {
    if (!selectedMerchantId) return 0;
    const balance = balances?.find((b) => b.merchantId === selectedMerchantId);
    return parseFloat(balance?.availableBalance || "0");
  };

  const donationMutation = useMutation({
    mutationFn: async (data: { charityId: string; merchantId: string; amount: string }) => {
      const response = await apiRequest("POST", "/api/donations", data);
      return response.json();
    },
    onSuccess: () => {
      setDonationSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/cashback/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/donations"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de faire le don",
        variant: "destructive",
      });
    },
  });

  const handleDonate = () => {
    if (!selectedCharity || !selectedMerchantId || !donationAmount) return;
    
    const amount = parseFloat(donationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Montant invalide",
        description: "Veuillez entrer un montant valide",
        variant: "destructive",
      });
      return;
    }

    if (amount > getSelectedBalance()) {
      toast({
        title: "Solde insuffisant",
        description: "Vous n'avez pas assez de cashback disponible",
        variant: "destructive",
      });
      return;
    }

    donationMutation.mutate({
      charityId: selectedCharity.id,
      merchantId: selectedMerchantId,
      amount: donationAmount,
    });
  };

  const openDonationDialog = (charity: Charity) => {
    setSelectedCharity(charity);
    setDonationSuccess(false);
    setDonationAmount("");
    setSelectedMerchantId(availableBalances[0]?.merchantId || "");
    setDonationDialogOpen(true);
  };

  const closeDonationDialog = () => {
    setDonationDialogOpen(false);
    setSelectedCharity(null);
    setDonationAmount("");
    setSelectedMerchantId("");
    setDonationSuccess(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-donations">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold">Faire un don</h2>
          <p className="text-sm text-muted-foreground">
            Utilisez votre cashback pour soutenir une association
          </p>
        </div>
      </div>

      {charitiesLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {charities && charities.length > 0 ? (
            charities.map((charity) => (
              <Card 
                key={charity.id} 
                className="border-card-border hover-elevate cursor-pointer"
                onClick={() => openDonationDialog(charity)}
                data-testid={`card-charity-${charity.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-md bg-rose-100 dark:bg-rose-900/30 flex-shrink-0">
                      <Heart className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{charity.name}</h3>
                        <Badge variant="secondary">
                          {categoryLabels[charity.category] || charity.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {charity.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Aucune association disponible pour le moment
            </p>
          )}
        </div>
      )}

      <Dialog open={donationDialogOpen} onOpenChange={(open) => !open && closeDonationDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              {donationSuccess ? "Don effectué" : "Faire un don"}
            </DialogTitle>
            {!donationSuccess && selectedCharity && (
              <DialogDescription>
                Donner à {selectedCharity.name}
              </DialogDescription>
            )}
          </DialogHeader>

          {donationSuccess ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-lg">Merci pour votre don !</p>
                <p className="text-muted-foreground">
                  Vous avez donné {donationAmount}€ à {selectedCharity?.name}
                </p>
              </div>
              <Button className="w-full" onClick={closeDonationDialog} data-testid="button-close-donation-success">
                Fermer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedCharity && (
                <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
                  <Heart className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{selectedCharity.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedCharity.description}</p>
                  </div>
                </div>
              )}

              {availableBalances.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">
                    Vous n'avez pas de cashback disponible pour faire un don.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Utiliser le cashback de</Label>
                    <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
                      <SelectTrigger data-testid="select-merchant-donation">
                        <SelectValue placeholder="Choisir un commerce" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBalances.map((balance) => (
                          <SelectItem key={balance.merchantId} value={balance.merchantId}>
                            {getMerchantName(balance.merchantId)} - {parseFloat(balance.availableBalance).toFixed(2)}€
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedMerchantId && (
                      <p className="text-sm text-muted-foreground">
                        Solde disponible: {getSelectedBalance().toFixed(2)}€
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="donation-amount">Montant du don (€)</Label>
                    <Input
                      id="donation-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={getSelectedBalance()}
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      placeholder="0.00"
                      data-testid="input-donation-amount"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={closeDonationDialog}
                      data-testid="button-cancel-donation"
                    >
                      Annuler
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleDonate}
                      disabled={!donationAmount || !selectedMerchantId || donationMutation.isPending}
                      data-testid="button-confirm-donation"
                    >
                      {donationMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Donner"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
