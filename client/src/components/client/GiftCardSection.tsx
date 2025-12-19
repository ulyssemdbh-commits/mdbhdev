import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Gift, Send, CreditCard, ArrowRight, Loader2 } from "lucide-react";
import type { GiftCard, GiftCardBalance, GiftCardPurchase } from "@shared/schema";

interface GiftCardWithDetails extends GiftCardBalance {
  giftCard?: GiftCard;
  purchase?: GiftCardPurchase;
}

export function GiftCardSection() {
  const { toast } = useToast();
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<GiftCardWithDetails | null>(null);
  const [recipientRevId, setRecipientRevId] = useState("");

  const { data: giftCards, isLoading: cardsLoading } = useQuery<GiftCard[]>({
    queryKey: ["/api/gift-cards"],
  });

  const { data: myBalances, isLoading: balancesLoading } = useQuery<GiftCardWithDetails[]>({
    queryKey: ["/api/gift-cards/my-balances"],
  });

  const purchaseMutation = useMutation({
    mutationFn: async (giftCardId: string) => {
      return apiRequest("POST", "/api/gift-cards/purchase", { giftCardId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gift-cards/my-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Achat effectue",
        description: "Votre carte cadeau a ete achetee avec succes. Vous recevrez 15% de CashBack !",
      });
      setPurchaseDialogOpen(false);
      setSelectedCard(null);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'acheter la carte cadeau",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async ({ balanceId, recipientRevId }: { balanceId: string; recipientRevId: string }) => {
      return apiRequest("POST", "/api/gift-cards/transfer", { balanceId, recipientRevId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gift-cards/my-balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({
        title: "Carte cadeau offerte",
        description: "Votre carte cadeau a ete envoyee avec succes !",
      });
      setTransferDialogOpen(false);
      setSelectedBalance(null);
      setRecipientRevId("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'offrir la carte cadeau",
      });
    },
  });

  const handlePurchase = () => {
    if (selectedCard) {
      purchaseMutation.mutate(selectedCard.id);
    }
  };

  const handleTransfer = () => {
    if (selectedBalance && recipientRevId) {
      transferMutation.mutate({ balanceId: selectedBalance.id, recipientRevId });
    }
  };

  const openTransferDialog = (balance: GiftCardWithDetails) => {
    setSelectedBalance(balance);
    setTransferDialogOpen(true);
  };

  if (cardsLoading || balancesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* My Gift Cards Section */}
      {myBalances && myBalances.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Mes Cartes Cadeaux
          </h2>
          <div className="space-y-3">
            {myBalances.map((balance) => {
              const unlocksAt = balance.purchase?.unlocksAt ? new Date(balance.purchase.unlocksAt) : null;
              const isLocked = unlocksAt ? new Date() < unlocksAt : false;
              return (
                <Card key={balance.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Gift className="w-4 h-4 text-primary" />
                          <span className="font-medium">{balance.giftCard?.title || "Carte Cadeau"}</span>
                        </div>
                        <div className="text-2xl font-bold text-primary">{parseFloat(balance.remainingValue).toFixed(2)} EUR</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {balance.receivedFromUserId && (
                            <Badge variant="secondary" className="text-xs" style={{ padding: "2px 8px", fontSize: "11px" }}>
                              Recu en cadeau
                            </Badge>
                          )}
                          {isLocked && unlocksAt && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300" style={{ padding: "2px 8px", fontSize: "11px" }}>
                              Disponible le {unlocksAt.toLocaleDateString("fr-FR")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => openTransferDialog(balance)}
                        variant="outline"
                        className="flex items-center gap-2"
                        style={{ backgroundColor: "#f5f5f5", color: "#000000" }}
                        disabled={isLocked}
                        data-testid={`button-transfer-giftcard-${balance.id}`}
                      >
                        <Send className="w-4 h-4" />
                        Offrir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Available Gift Cards Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Acheter une Carte Cadeau
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Achetez une carte cadeau et recevez 15% de CashBack !
        </p>

        {giftCards && giftCards.length > 0 ? (
          <div className="grid gap-4">
            {giftCards.map((card) => {
              const cashbackAmount = parseFloat(card.faceValue) * parseFloat(card.cashbackRate) / 100;
              return (
                <Card key={card.id} className="overflow-hidden hover-elevate">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-lg">{card.title}</div>
                        {card.description && (
                          <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-2xl font-bold">{parseFloat(card.faceValue).toFixed(2)} EUR</span>
                          <Badge 
                            variant="secondary" 
                            className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            style={{ padding: "2px 8px", fontSize: "11px" }}
                          >
                            +{cashbackAmount.toFixed(2)} EUR CashBack
                          </Badge>
                        </div>
                      </div>
                      <Button
                        onClick={() => {
                          setSelectedCard(card);
                          setPurchaseDialogOpen(true);
                        }}
                        style={{ backgroundColor: "#f5f5f5", color: "#000000" }}
                        data-testid={`button-buy-giftcard-${card.id}`}
                      >
                        Acheter
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Aucune carte cadeau disponible pour le moment</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'achat</DialogTitle>
            <DialogDescription>
              Vous allez acheter une carte cadeau avec 15% de CashBack.
            </DialogDescription>
          </DialogHeader>
          {selectedCard && (
            <div className="py-4">
              <div className="text-center mb-4">
                <div className="text-lg font-medium">{selectedCard.title}</div>
                <div className="text-3xl font-bold text-primary mt-2">
                  {parseFloat(selectedCard.faceValue).toFixed(2)} EUR
                </div>
                <Badge 
                  variant="secondary" 
                  className="mt-2 bg-green-100 text-green-700"
                  style={{ padding: "4px 12px", fontSize: "13px" }}
                >
                  +{(parseFloat(selectedCard.faceValue) * 0.15).toFixed(2)} EUR CashBack
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Le CashBack sera disponible apres 7 jours ouvrables.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handlePurchase}
              disabled={purchaseMutation.isPending}
              data-testid="button-confirm-purchase"
            >
              {purchaseMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmer l'achat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Offrir une carte cadeau</DialogTitle>
            <DialogDescription>
              Envoyez cette carte cadeau a un ami en utilisant son REVid.
            </DialogDescription>
          </DialogHeader>
          {selectedBalance && (
            <div className="py-4 space-y-4">
              <div className="text-center mb-4">
                <div className="text-lg font-medium">{selectedBalance.giftCard?.title || "Carte Cadeau"}</div>
                <div className="text-2xl font-bold text-primary mt-2">
                  {parseFloat(selectedBalance.remainingValue).toFixed(2)} EUR
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipient-revid">REVid du destinataire</Label>
                <Input
                  id="recipient-revid"
                  placeholder="Ex: REV-ABCD-1234"
                  value={recipientRevId}
                  onChange={(e) => setRecipientRevId(e.target.value.toUpperCase())}
                  data-testid="input-recipient-revid"
                />
                <p className="text-xs text-muted-foreground">
                  Le destinataire recevra la carte cadeau instantanement.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={transferMutation.isPending || !recipientRevId}
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Envoyer le cadeau
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
