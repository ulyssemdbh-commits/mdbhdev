import { useState, useRef, useEffect } from "react";
import { Camera, X, Keyboard, Send, ArrowLeft, Loader2, User, Store, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CashbackBalance, Merchant } from "@shared/schema";

interface RecipientInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
}

export function CashbackTransfer() {
  const [step, setStep] = useState<"scan" | "confirm" | "success">("scan");
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [recipientInfo, setRecipientInfo] = useState<RecipientInfo | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState<string>("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  const { data: balances = [] } = useQuery<CashbackBalance[]>({
    queryKey: ["/api/cashback/balances"],
  });

  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/merchants"],
  });

  const merchantBalanceMap = new Map<string, string>();
  balances.forEach((b) => {
    merchantBalanceMap.set(b.merchantId, b.availableBalance);
  });

  const merchantsWithBalance = merchants.filter(
    (m) => parseFloat(merchantBalanceMap.get(m.id) || "0") > 0
  );

  const selectedMerchantBalance = selectedMerchantId
    ? parseFloat(merchantBalanceMap.get(selectedMerchantId) || "0")
    : 0;

  const transferMutation = useMutation({
    mutationFn: async (data: { toUserId: string; merchantId: string; amount: string }) => {
      const response = await apiRequest("POST", "/api/cashback/transfer", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cashback/balances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashback/transfers"] });
      setStep("success");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de transférer le cashback",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (step !== "scan" || showManualInput) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.log("Camera access denied or not available");
        setShowManualInput(true);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [step, showManualInput]);

  const fetchRecipientInfo = async (userId: string) => {
    setIsLoadingRecipient(true);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Utilisateur non trouvé");
      }
      const data = await response.json();
      setRecipientInfo(data);
      setRecipientId(userId);
      setStep("confirm");
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de trouver cet utilisateur",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRecipient(false);
    }
  };

  const handleScanResult = (scannedValue: string) => {
    let userId = scannedValue;
    if (scannedValue.startsWith("REV-CLIENT-")) {
      userId = scannedValue.replace("REV-CLIENT-", "");
    }
    fetchRecipientInfo(userId);
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      handleScanResult(manualInput.trim());
    }
  };

  const handleTransfer = () => {
    if (!recipientId || !selectedMerchantId || !transferAmount) return;
    
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Montant invalide",
        description: "Veuillez entrer un montant valide",
        variant: "destructive",
      });
      return;
    }

    if (amount > selectedMerchantBalance) {
      toast({
        title: "Solde insuffisant",
        description: "Vous n'avez pas assez de cashback disponible",
        variant: "destructive",
      });
      return;
    }

    transferMutation.mutate({
      toUserId: recipientId,
      merchantId: selectedMerchantId,
      amount: amount.toFixed(2),
    });
  };

  const resetTransfer = () => {
    setStep("scan");
    setRecipientId(null);
    setRecipientInfo(null);
    setSelectedMerchantId("");
    setTransferAmount("");
    setShowManualInput(false);
    setManualInput("");
  };

  const getRecipientDisplayName = () => {
    if (!recipientInfo) return "Utilisateur";
    const name = `${recipientInfo.firstName || ""} ${recipientInfo.lastName || ""}`.trim();
    return name || recipientInfo.email || "Utilisateur";
  };

  if (step === "success") {
    return (
      <Card className="border-card-border">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-xl font-semibold">Transfert réussi !</h3>
          <p className="text-muted-foreground">
            Vous avez envoyé {transferAmount}€ à {getRecipientDisplayName()}
          </p>
          <Button onClick={resetTransfer} className="w-full" data-testid="button-new-transfer">
            Nouveau transfert
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === "confirm") {
    return (
      <Card className="border-card-border">
        <CardContent className="p-6 space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep("scan")}
            className="gap-2"
            data-testid="button-back-to-scan"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>

          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
              {recipientInfo?.profileImageUrl ? (
                <img
                  src={recipientInfo.profileImageUrl}
                  alt={getRecipientDisplayName()}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <User className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <h3 className="font-semibold text-lg" data-testid="text-recipient-name">
              {getRecipientDisplayName()}
            </h3>
            <p className="text-sm text-muted-foreground">Destinataire du transfert</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sélectionnez une boutique</Label>
              {merchantsWithBalance.length > 0 ? (
                <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
                  <SelectTrigger data-testid="select-merchant">
                    <SelectValue placeholder="Choisir une boutique" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchantsWithBalance.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <Store className="w-4 h-4" />
                          <span>{m.name}</span>
                          <span className="text-muted-foreground">
                            ({merchantBalanceMap.get(m.id)}€)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Vous n'avez pas de cashback disponible à transférer
                </p>
              )}
            </div>

            {selectedMerchantId && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Montant à transférer</Label>
                  <span className="text-sm text-muted-foreground">
                    Disponible: {selectedMerchantBalance.toFixed(2)}€
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedMerchantBalance}
                    placeholder="0.00"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    data-testid="input-transfer-amount"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setTransferAmount(selectedMerchantBalance.toFixed(2))}
                    data-testid="button-transfer-all"
                  >
                    Tout
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            className="w-full gap-2"
            onClick={handleTransfer}
            disabled={
              !selectedMerchantId ||
              !transferAmount ||
              parseFloat(transferAmount) <= 0 ||
              parseFloat(transferAmount) > selectedMerchantBalance ||
              transferMutation.isPending
            }
            data-testid="button-confirm-transfer"
          >
            {transferMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Envoyer le cashback
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showManualInput) {
    return (
      <Card className="border-card-border">
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <Keyboard className="w-12 h-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold text-lg">Saisie manuelle</h3>
            <p className="text-sm text-muted-foreground">
              Entrez le code du membre destinataire
            </p>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="Code membre ou email"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              data-testid="input-recipient-code"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowManualInput(false)}
                data-testid="button-back-to-camera"
              >
                Retour au scan
              </Button>
              <Button
                className="flex-1"
                onClick={handleManualSubmit}
                disabled={!manualInput.trim() || isLoadingRecipient}
                data-testid="button-submit-recipient"
              >
                {isLoadingRecipient ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Valider"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-card-border overflow-hidden">
      <CardContent className="p-0">
        <div className="relative aspect-square bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white rounded-lg relative">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>
          <div className="absolute top-4 left-0 right-0 text-center">
            <p className="text-white text-sm font-medium bg-black/50 inline-block px-3 py-1 rounded-full">
              Scannez le QR code d'un membre
            </p>
          </div>
        </div>
        <div className="p-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => setShowManualInput(true)}
            data-testid="button-manual-entry"
          >
            <Keyboard className="w-4 h-4" />
            Saisie manuelle
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={() => {
              const mockUserId = "mock-" + Math.random().toString(36).substr(2, 9);
              handleScanResult(mockUserId);
            }}
            data-testid="button-simulate-scan"
          >
            <Camera className="w-4 h-4" />
            Simuler scan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
