import { useState } from "react";
import { Search, Check, X, Eye, Tag, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface AdminMerchant {
  id: string;
  name: string;
  status: "pending" | "active" | "suspended";
  joinDate: string;
  totalSales: number;
  hasBonsPlanPack: boolean;
}

interface MerchantManagementProps {
  merchants: AdminMerchant[];
  onValidate?: (id: string) => void;
  onSuspend?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const statusConfig = {
  pending: {
    label: "En attente",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  active: {
    label: "Actif",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  suspended: {
    label: "Suspendu",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function MerchantManagement({
  merchants,
  onValidate,
  onSuspend,
  onViewDetails,
  onEdit,
  onDelete,
}: MerchantManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMerchants = merchants.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  return (
    <Card className="border-card-border">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-lg">Gestion des commerçants</CardTitle>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un commerçant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-admin-merchant-search"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="max-h-[400px]">
          <div className="px-6 pb-6 space-y-3">
            {filteredMerchants.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Aucun commerçant trouvé
              </p>
            ) : (
              filteredMerchants.map((merchant) => {
                const config = statusConfig[merchant.status];
                return (
                  <div
                    key={merchant.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/30 border"
                    data-testid={`admin-merchant-${merchant.id}`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{merchant.name}</p>
                        <Badge className={config.className}>
                          {config.label}
                        </Badge>
                        {merchant.hasBonsPlanPack && (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 gap-1">
                            <Tag className="w-3 h-3" />
                            Bons Plans
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>Inscrit le {merchant.joinDate}</span>
                        <span>•</span>
                        <span>CA: {formatCurrency(merchant.totalSales)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {merchant.status === "pending" && onValidate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-emerald-600"
                          onClick={() => onValidate(merchant.id)}
                          data-testid={`button-validate-${merchant.id}`}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      {merchant.status === "active" && onSuspend && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => onSuspend(merchant.id)}
                          data-testid={`button-suspend-${merchant.id}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      {onViewDetails && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onViewDetails(merchant.id)}
                          data-testid={`button-view-${merchant.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEdit(merchant.id)}
                          data-testid={`button-edit-${merchant.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => onDelete(merchant.id)}
                          data-testid={`button-delete-${merchant.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
