import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Gift, Percent, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Promotion } from "@shared/schema";

interface MerchantPromotionsProps {
  onBack: () => void;
}

type PromotionType = "cashback_boost" | "free_article" | "discount_percent";

interface PromotionFormData {
  type: PromotionType;
  title: string;
  description: string;
  cashbackBoostRate: string;
  freeArticle: string;
  discountPercent: string;
  startDate: string;
  endDate: string;
}

const defaultFormData: PromotionFormData = {
  type: "cashback_boost",
  title: "",
  description: "",
  cashbackBoostRate: "15",
  freeArticle: "",
  discountPercent: "10",
  startDate: new Date().toISOString().split("T")[0],
  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
};

const typeLabels: Record<PromotionType, string> = {
  cashback_boost: "Cashback augmenté",
  free_article: "Article offert",
  discount_percent: "Réduction %",
};

const typeIcons: Record<PromotionType, typeof TrendingUp> = {
  cashback_boost: TrendingUp,
  free_article: Gift,
  discount_percent: Percent,
};

export function MerchantPromotions({ onBack }: MerchantPromotionsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [deletePromoId, setDeletePromoId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PromotionFormData>(defaultFormData);
  const { toast } = useToast();

  const { data: promotions = [], isLoading } = useQuery<Promotion[]>({
    queryKey: ["/api/merchant/promotions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      return apiRequest("POST", "/api/merchant/promotions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/promotions"] });
      toast({ title: "Bon plan créé", description: "Votre offre est maintenant active" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer l'offre", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PromotionFormData> }) => {
      return apiRequest("PATCH", `/api/merchant/promotions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/promotions"] });
      toast({ title: "Bon plan modifié", description: "Les modifications ont été enregistrées" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier l'offre", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/merchant/promotions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/merchant/promotions"] });
      toast({ title: "Bon plan supprimé", description: "L'offre a été supprimée" });
      setDeletePromoId(null);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer l'offre", variant: "destructive" });
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingPromo(null);
    setFormData(defaultFormData);
  };

  const openCreateDialog = () => {
    setFormData(defaultFormData);
    setEditingPromo(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormData({
      type: promo.type as PromotionType,
      title: promo.title,
      description: promo.description || "",
      cashbackBoostRate: promo.cashbackBoostRate || "15",
      freeArticle: promo.freeArticle || "",
      discountPercent: promo.discountPercent || "10",
      startDate: new Date(promo.startDate).toISOString().split("T")[0],
      endDate: new Date(promo.endDate).toISOString().split("T")[0],
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({ title: "Erreur", description: "Le titre est requis", variant: "destructive" });
      return;
    }

    if (editingPromo) {
      updateMutation.mutate({ id: editingPromo.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPromotionActive = (promo: Promotion) => {
    const now = new Date();
    return promo.isActive && new Date(promo.startDate) <= now && new Date(promo.endDate) >= now;
  };

  const getPromotionValue = (promo: Promotion) => {
    switch (promo.type) {
      case "cashback_boost":
        return `${promo.cashbackBoostRate}% de cashback`;
      case "free_article":
        return promo.freeArticle;
      case "discount_percent":
        return `${promo.discountPercent}% de réduction`;
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} data-testid="button-back-promotions">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Mes Bons Plans</h2>
      </div>

      <Button onClick={openCreateDialog} className="w-full gap-2" data-testid="button-create-promotion">
        <Plus className="w-4 h-4" />
        Créer une nouvelle offre
      </Button>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : promotions.length === 0 ? (
        <Card className="border-card-border">
          <CardContent className="p-6 text-center text-muted-foreground">
            Aucune offre pour le moment. Créez votre premier bon plan !
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {promotions.map((promo) => {
            const Icon = typeIcons[promo.type as PromotionType] || Gift;
            const active = isPromotionActive(promo);
            return (
              <Card key={promo.id} className="border-card-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-md ${active ? "bg-primary/10" : "bg-muted"}`}>
                        <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium" data-testid={`text-promo-title-${promo.id}`}>
                            {promo.title}
                          </h3>
                          <Badge variant={active ? "default" : "secondary"}>
                            {active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {typeLabels[promo.type as PromotionType]}: {getPromotionValue(promo)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Du {new Date(promo.startDate).toLocaleDateString("fr-FR")} au{" "}
                          {new Date(promo.endDate).toLocaleDateString("fr-FR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(promo)}
                        data-testid={`button-edit-promo-${promo.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletePromoId(promo.id)}
                        data-testid={`button-delete-promo-${promo.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPromo ? "Modifier l'offre" : "Nouvelle offre"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type d'offre</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as PromotionType })}
              >
                <SelectTrigger data-testid="select-promo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cashback_boost">Cashback augmenté</SelectItem>
                  <SelectItem value="free_article">Article offert</SelectItem>
                  <SelectItem value="discount_percent">Réduction %</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Titre de l'offre</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Offre de Noël"
                data-testid="input-promo-title"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Détails de l'offre..."
                data-testid="input-promo-description"
              />
            </div>

            {formData.type === "cashback_boost" && (
              <div className="space-y-2">
                <Label>Taux de cashback (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={formData.cashbackBoostRate}
                  onChange={(e) => setFormData({ ...formData, cashbackBoostRate: e.target.value })}
                  data-testid="input-promo-cashback-rate"
                />
              </div>
            )}

            {formData.type === "free_article" && (
              <div className="space-y-2">
                <Label>Article offert</Label>
                <Input
                  value={formData.freeArticle}
                  onChange={(e) => setFormData({ ...formData, freeArticle: e.target.value })}
                  placeholder="Ex: Café offert"
                  data-testid="input-promo-free-article"
                />
              </div>
            )}

            {formData.type === "discount_percent" && (
              <div className="space-y-2">
                <Label>Pourcentage de réduction</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.discountPercent}
                  onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                  data-testid="input-promo-discount"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  data-testid="input-promo-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  data-testid="input-promo-end-date"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-promo"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingPromo ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePromoId} onOpenChange={() => setDeletePromoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette offre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'offre sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePromoId && deleteMutation.mutate(deletePromoId)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-promo"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
