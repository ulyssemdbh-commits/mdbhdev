import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import type { Merchant, MerchantCategory } from "@shared/schema";

interface EditMerchantDialogProps {
  merchant: Merchant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<Merchant>) => void;
  isPending?: boolean;
}

export function EditMerchantDialog({ merchant, open, onOpenChange, onSave, isPending }: EditMerchantDialogProps) {
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<MerchantCategory[]>({
    queryKey: ["/api/merchant-categories"],
    enabled: open,
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [siret, setSiret] = useState("");
  const [contactName, setContactName] = useState("");
  const [bankIban, setBankIban] = useState("");
  const [bankBic, setBankBic] = useState("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (merchant) {
      setName(merchant.name);
      setDescription(merchant.description || "");
      setCategory(merchant.category);
      setAddress(merchant.address || "");
      setPhone(merchant.phone || "");
      setEmail(merchant.email || "");
      setSiret(merchant.siret || "");
      setContactName(merchant.contactName || "");
      setBankIban(merchant.bankIban || "");
      setBankBic(merchant.bankBic || "");
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
      phone,
      email,
      siret,
      contactName,
      bankIban,
      bankBic,
      isActive,
    });
  };

  if (!merchant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Modifier le commerçant</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-4">
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
                <SelectContent className="max-h-[240px]">
                  {categoriesLoading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  ) : categories.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      Aucune catégorie disponible
                    </div>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))
                  )}
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
              <Label htmlFor="edit-phone">Téléphone</Label>
              <Input
                id="edit-phone"
                data-testid="input-edit-merchant-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01 23 45 67 89"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                data-testid="input-edit-merchant-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@commerce.fr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-contact">Nom du contact</Label>
              <Input
                id="edit-contact"
                data-testid="input-edit-merchant-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-siret">Numéro SIRET</Label>
              <Input
                id="edit-siret"
                data-testid="input-edit-merchant-siret"
                value={siret}
                onChange={(e) => setSiret(e.target.value)}
                placeholder="12345678901234"
                maxLength={14}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Coordonnées bancaires</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-iban">IBAN</Label>
                  <Input
                    id="edit-iban"
                    data-testid="input-edit-merchant-iban"
                    value={bankIban}
                    onChange={(e) => setBankIban(e.target.value)}
                    placeholder="FR76 1234 5678 9012 3456 7890 123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-bic">BIC</Label>
                  <Input
                    id="edit-bic"
                    data-testid="input-edit-merchant-bic"
                    value={bankBic}
                    onChange={(e) => setBankBic(e.target.value)}
                    placeholder="BNPAFRPP"
                  />
                </div>
              </div>
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
