import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Store, MapPin, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const merchantSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  description: z.string().optional(),
  category: z.string().min(1, "Veuillez sélectionner une catégorie"),
  address: z.string().min(5, "L'adresse doit contenir au moins 5 caractères"),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
});

type MerchantFormData = z.infer<typeof merchantSchema>;

interface AddMerchantDialogProps {
  onSubmit: (data: MerchantFormData) => Promise<void>;
  isLoading?: boolean;
}

const categories = [
  { value: "boulangerie", label: "Boulangerie / Pâtisserie" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café / Bar" },
  { value: "epicerie", label: "Épicerie" },
  { value: "pharmacie", label: "Pharmacie" },
  { value: "fleuriste", label: "Fleuriste" },
  { value: "coiffeur", label: "Coiffeur / Beauté" },
  { value: "vetements", label: "Vêtements" },
  { value: "librairie", label: "Librairie / Papeterie" },
  { value: "autre", label: "Autre" },
];

export function AddMerchantDialog({ onSubmit, isLoading }: AddMerchantDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<MerchantFormData>({
    resolver: zodResolver(merchantSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      address: "",
      phone: "",
      email: "",
    },
  });

  const handleSubmit = async (data: MerchantFormData) => {
    await onSubmit(data);
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-merchant">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un commerçant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            Nouveau commerçant
          </DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau commerçant au réseau REV
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du commerce</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Boulangerie Antoine" 
                      {...field} 
                      data-testid="input-merchant-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catégorie</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-merchant-category">
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Décrivez brièvement le commerce..." 
                      {...field} 
                      data-testid="input-merchant-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="12 rue du Commerce, 75001 Paris" 
                        className="pl-9"
                        {...field} 
                        data-testid="input-merchant-address"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone (optionnel)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="01 23 45 67 89" 
                        className="pl-9"
                        {...field} 
                        data-testid="input-merchant-phone"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optionnel)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        type="email"
                        placeholder="contact@commerce.fr" 
                        className="pl-9"
                        {...field} 
                        data-testid="input-merchant-email"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
                data-testid="button-cancel-merchant"
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                data-testid="button-submit-merchant"
              >
                {isLoading ? "Enregistrement..." : "Ajouter"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
