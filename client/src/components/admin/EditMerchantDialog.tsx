import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Merchant } from "@shared/schema";

interface EditMerchantDialogProps {
  merchant: Merchant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<Merchant>) => void;
  isPending?: boolean;
}

const categories = [
  { value: "alimentation", label: "Alimentation" },
  { value: "restauration", label: "Restauration" },
  { value: "sante", label: "Santé" },
  { value: "services", label: "Services" },
  { value: "mode", label: "Mode" },
  { value: "beaute", label: "Beauté" },
  { value: "loisirs", label: "Loisirs" },
  { value: "autre", label: "Autre" },
];

export function EditMerchantDialog({ merchant, open, onOpenChange, onSave, isPending }: EditMerchantDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (merchant) {
      setName(merchant.name);
      setDescription(merchant.description || "");
      setCategory(merchant.category);
      setAddress(merchant.address || "");
      setIsActive(merchant.isActive);
    }
  }, [merchant]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchant) return;
    
    onSave(merchant.id, {
      name,
      description,
      category,
      address,
      isActive,
    });
  };

  if (!merchant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier le commerçant</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nom du commerce</Label>
            <Input
              id="edit-name"
              data-testid="input-edit-merchant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit-category">Catégorie</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-edit-category">
                <SelectValue placeholder="Sélectionner une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-address">Adresse</Label>
            <Input
              id="edit-address"
              data-testid="input-edit-merchant-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              data-testid="input-edit-merchant-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="edit-active">Compte actif</Label>
            <Switch
              id="edit-active"
              data-testid="switch-edit-merchant-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" data-testid="button-save-merchant" disabled={isPending}>
              {isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
