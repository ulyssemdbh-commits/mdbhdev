import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Users, Store, TrendingUp, Euro, Mail, Calendar, Phone, MapPin, Pencil, Trash2, X, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User, Merchant, Transaction } from "@shared/schema";

interface ClientsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientsListDialog({ open, onOpenChange }: ClientsListDialogProps) {
  const { toast } = useToast();
  const [editingClient, setEditingClient] = useState<User | null>(null);
  const [deletingClient, setDeletingClient] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", role: "" });

  const { data: clients = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/clients"],
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<User> }) => {
      return apiRequest("PATCH", `/api/admin/clients/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditingClient(null);
      toast({ title: "Client modifié avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeletingClient(null);
      toast({ title: "Client archivé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const startEdit = (client: User) => {
    setEditForm({
      firstName: client.firstName || "",
      lastName: client.lastName || "",
      email: client.email || "",
      role: client.role || "client",
    });
    setEditingClient(client);
  };

  const saveEdit = () => {
    if (!editingClient) return;
    updateMutation.mutate({
      id: editingClient.id,
      updates: editForm,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Clients inscrits ({clients.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : clients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun client inscrit
              </p>
            ) : (
              <div className="space-y-3 pr-4">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                    data-testid={`client-row-${client.id}`}
                  >
                    {editingClient?.id === client.id ? (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Prénom</Label>
                            <Input
                              value={editForm.firstName}
                              onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                              data-testid="input-edit-firstName"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Nom</Label>
                            <Input
                              value={editForm.lastName}
                              onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                              data-testid="input-edit-lastName"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Email</Label>
                          <Input
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            data-testid="input-edit-email"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Rôle</Label>
                          <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                            <SelectTrigger data-testid="select-edit-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="client">Client</SelectItem>
                              <SelectItem value="merchant">Commerçant</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingClient(null)} data-testid="button-cancel-edit">
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          {client.profileImageUrl ? (
                            <img
                              src={client.profileImageUrl}
                              alt={client.firstName || "Client"}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate" data-testid={`text-client-name-${client.id}`}>
                            {client.firstName || client.lastName
                              ? `${client.firstName || ""} ${client.lastName || ""}`.trim()
                              : "Client"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{client.email || "Email non renseigné"}</span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {client.createdAt
                              ? format(new Date(client.createdAt), "dd MMM yyyy", { locale: fr })
                              : "N/A"}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(client)} data-testid={`button-edit-client-${client.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingClient(client)} data-testid={`button-delete-client-${client.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archiver ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir archiver le client "{deletingClient?.firstName} {deletingClient?.lastName}" ?
              Le client ne pourra plus accéder à son compte mais ses données seront conservées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingClient && deleteMutation.mutate(deletingClient.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Archiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface MerchantsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MerchantsListDialog({ open, onOpenChange }: MerchantsListDialogProps) {
  const { toast } = useToast();
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [deletingMerchant, setDeletingMerchant] = useState<Merchant | null>(null);
  const [editForm, setEditForm] = useState({ name: "", category: "", phone: "", address: "", isActive: true });

  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    enabled: open,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Merchant> }) => {
      return apiRequest("PATCH", `/api/admin/merchants/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditingMerchant(null);
      toast({ title: "Commerçant modifié avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/merchants/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/merchants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeletingMerchant(null);
      toast({ title: "Commerçant supprimé avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const startEdit = (merchant: Merchant) => {
    setEditForm({
      name: merchant.name || "",
      category: merchant.category || "",
      phone: merchant.phone || "",
      address: merchant.address || "",
      isActive: merchant.isActive,
    });
    setEditingMerchant(merchant);
  };

  const saveEdit = () => {
    if (!editingMerchant) return;
    updateMutation.mutate({
      id: editingMerchant.id,
      updates: editForm,
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              Commerçants ({merchants.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : merchants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun commerçant
              </p>
            ) : (
              <div className="space-y-3 pr-4">
                {merchants.map((merchant) => (
                  <div
                    key={merchant.id}
                    className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                    data-testid={`merchant-row-${merchant.id}`}
                  >
                    {editingMerchant?.id === merchant.id ? (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Nom</Label>
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              data-testid="input-edit-name"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Catégorie</Label>
                            <Input
                              value={editForm.category}
                              onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                              data-testid="input-edit-category"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Téléphone</Label>
                            <Input
                              value={editForm.phone}
                              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                              data-testid="input-edit-phone"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Statut</Label>
                            <Select 
                              value={editForm.isActive ? "active" : "inactive"} 
                              onValueChange={(v) => setEditForm({ ...editForm, isActive: v === "active" })}
                            >
                              <SelectTrigger data-testid="select-edit-status">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Actif</SelectItem>
                                <SelectItem value="inactive">Inactif</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Adresse</Label>
                          <Input
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            data-testid="input-edit-address"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingMerchant(null)} data-testid="button-cancel-edit-merchant">
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit-merchant">
                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <Store className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium" data-testid={`text-merchant-name-${merchant.id}`}>
                              {merchant.name}
                            </p>
                            <Badge variant={merchant.isActive ? "default" : "secondary"}>
                              {merchant.isActive ? "Actif" : "Inactif"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1 flex-wrap">
                            {merchant.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {merchant.address}
                              </span>
                            )}
                            {merchant.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {merchant.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <Badge variant="outline">{merchant.category}</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => startEdit(merchant)} data-testid={`button-edit-merchant-${merchant.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeletingMerchant(merchant)} data-testid={`button-delete-merchant-${merchant.id}`}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingMerchant} onOpenChange={(open) => !open && setDeletingMerchant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce commerçant ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le commerçant "{deletingMerchant?.name}" ?
              Cette action est irréversible et supprimera toutes les données associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-merchant">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMerchant && deleteMutation.mutate(deletingMerchant.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete-merchant"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface TransactionsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransactionsListDialog({ open, onOpenChange }: TransactionsListDialogProps) {
  const { toast } = useToast();
  const [cancellingTx, setCancellingTx] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: open,
  });

  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    enabled: open,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/transactions/${id}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCancellingTx(null);
      toast({ title: "Transaction annulée avec succès" });
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(parseFloat(value));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Transactions ({transactions.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucune transaction
              </p>
            ) : (
              <div className="space-y-3 pr-4">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                    data-testid={`transaction-row-${tx.id}`}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {merchantMap.get(tx.merchantId) || "Commerçant"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(tx.createdAt), "dd MMM yyyy HH:mm", { locale: fr })}
                        </span>
                        <Badge 
                          variant={tx.status === "completed" ? "default" : tx.status === "cancelled" ? "destructive" : "secondary"}
                        >
                          {tx.status === "completed" ? "Terminée" : tx.status === "cancelled" ? "Annulée" : "En attente"}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-lg" data-testid={`text-tx-amount-${tx.id}`}>
                        {formatCurrency(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Commission: {formatCurrency(tx.commissionAmount)}
                      </p>
                    </div>
                    {tx.status === "completed" && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => setCancellingTx(tx)}
                        data-testid={`button-cancel-tx-${tx.id}`}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancellingTx} onOpenChange={(open) => !open && setCancellingTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette transaction ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler cette transaction de {cancellingTx ? formatCurrency(cancellingTx.amount) : ""} ?
              Cette action marquera la transaction comme annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-cancel-tx">Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancellingTx && cancelMutation.mutate(cancellingTx.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-cancel-tx"
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Annuler la transaction"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface CommissionsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommissionsListDialog({ open, onOpenChange }: CommissionsListDialogProps) {
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: open,
  });

  const { data: merchants = [] } = useQuery<Merchant[]>({
    queryKey: ["/api/admin/merchants"],
    enabled: open,
  });

  const completedTx = transactions.filter((tx) => tx.status === "completed");
  const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

  const commissionsByMerchant = completedTx.reduce((acc, tx) => {
    if (!acc[tx.merchantId]) {
      acc[tx.merchantId] = { total: 0, count: 0 };
    }
    acc[tx.merchantId].total += parseFloat(tx.commissionAmount);
    acc[tx.merchantId].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  const commissionsList = Object.entries(commissionsByMerchant)
    .map(([merchantId, data]) => ({
      merchantId,
      merchantName: merchantMap.get(merchantId) || "Commerçant",
      ...data,
    }))
    .sort((a, b) => b.total - a.total);

  const totalCommissions = commissionsList.reduce((sum, c) => sum + c.total, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Euro className="w-5 h-5 text-amber-600" />
            Commissions par commerçant
          </DialogTitle>
        </DialogHeader>
        <div className="mb-4 p-4 rounded-md bg-amber-100 dark:bg-amber-900/30">
          <p className="text-sm text-muted-foreground">Total des commissions</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
            {formatCurrency(totalCommissions)}
          </p>
        </div>
        <ScrollArea className="max-h-[50vh]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : commissionsList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucune commission
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              {commissionsList.map((commission) => (
                <div
                  key={commission.merchantId}
                  className="flex items-center gap-4 p-4 rounded-md bg-muted/50"
                  data-testid={`commission-row-${commission.merchantId}`}
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Euro className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium" data-testid={`text-commission-merchant-${commission.merchantId}`}>
                      {commission.merchantName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {commission.count} transaction{commission.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg text-amber-700 dark:text-amber-400">
                      {formatCurrency(commission.total)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
