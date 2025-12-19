import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Filter, TrendingUp, Store, Calendar, Tag, Trash2, Power, PowerOff, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Promotion } from "@shared/schema";

interface EnrichedPromotion extends Promotion {
  merchantName: string;
  merchantCategory: string;
}

type SortField = "createdAt" | "startDate" | "endDate" | "merchantName" | "type";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "active" | "expired" | "upcoming" | "inactive";

export function BonsPlansManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [merchantFilter, setMerchantFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data: promotions = [], isLoading } = useQuery<EnrichedPromotion[]>({
    queryKey: ["/api/admin/promotions"],
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/promotions/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({ title: "Statut mis a jour" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le statut", variant: "destructive" });
    },
  });

  const deletePromotionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/promotions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({ title: "Bon plan supprime" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    },
  });

  const now = new Date();

  const getPromoStatus = (promo: EnrichedPromotion): StatusFilter => {
    if (!promo.isActive) return "inactive";
    const start = new Date(promo.startDate);
    const end = new Date(promo.endDate);
    if (now < start) return "upcoming";
    if (now > end) return "expired";
    return "active";
  };

  const uniqueMerchants = useMemo(() => {
    const merchants = new Set(promotions.map(p => p.merchantName));
    return Array.from(merchants).sort();
  }, [promotions]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(promotions.map(p => p.type));
    return Array.from(types);
  }, [promotions]);

  const filteredAndSortedPromotions = useMemo(() => {
    let result = [...promotions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(term) ||
        p.merchantName.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(p => getPromoStatus(p) === statusFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter(p => p.type === typeFilter);
    }

    if (merchantFilter !== "all") {
      result = result.filter(p => p.merchantName === merchantFilter);
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "startDate":
          comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
          break;
        case "endDate":
          comparison = new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
          break;
        case "merchantName":
          comparison = a.merchantName.localeCompare(b.merchantName);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortDirection === "desc" ? -comparison : comparison;
    });

    return result;
  }, [promotions, searchTerm, statusFilter, typeFilter, merchantFilter, sortField, sortDirection]);

  const stats = useMemo(() => {
    const active = promotions.filter(p => getPromoStatus(p) === "active").length;
    const upcoming = promotions.filter(p => getPromoStatus(p) === "upcoming").length;
    const expired = promotions.filter(p => getPromoStatus(p) === "expired").length;
    const inactive = promotions.filter(p => getPromoStatus(p) === "inactive").length;
    return { total: promotions.length, active, upcoming, expired, inactive };
  }, [promotions]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "cashback_boost": return "Boost CashBack";
      case "free_article": return "Article Offert";
      case "discount_percent": return "Reduction";
      default: return type;
    }
  };

  const getStatusBadge = (promo: EnrichedPromotion) => {
    const status = getPromoStatus(promo);
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" style={{ padding: "2px 8px", fontSize: "11px" }}>Actif</Badge>;
      case "upcoming":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" style={{ padding: "2px 8px", fontSize: "11px" }}>A venir</Badge>;
      case "expired":
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" style={{ padding: "2px 8px", fontSize: "11px" }}>Expire</Badge>;
      case "inactive":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" style={{ padding: "2px 8px", fontSize: "11px" }}>Desactive</Badge>;
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-card-border">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Actifs</div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.upcoming}</div>
            <div className="text-xs text-muted-foreground">A venir</div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-500">{stats.expired}</div>
            <div className="text-xs text-muted-foreground">Expires</div>
          </CardContent>
        </Card>
        <Card className="border-card-border">
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
            <div className="text-xs text-muted-foreground">Desactives</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres et Recherche
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-promotions"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="upcoming">A venir</SelectItem>
                <SelectItem value="expired">Expires</SelectItem>
                <SelectItem value="inactive">Desactives</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {uniqueTypes.map(type => (
                  <SelectItem key={type} value={type}>{getTypeLabel(type)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={merchantFilter} onValueChange={setMerchantFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-merchant-filter">
                <SelectValue placeholder="Commercant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous commercants</SelectItem>
                {uniqueMerchants.map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort("createdAt")}
              className={sortField === "createdAt" ? "bg-accent" : ""}
              data-testid="button-sort-created"
            >
              <ArrowUpDown className="w-3 h-3 mr-1" />
              Date creation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort("startDate")}
              className={sortField === "startDate" ? "bg-accent" : ""}
              data-testid="button-sort-start"
            >
              <ArrowUpDown className="w-3 h-3 mr-1" />
              Debut
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort("endDate")}
              className={sortField === "endDate" ? "bg-accent" : ""}
              data-testid="button-sort-end"
            >
              <ArrowUpDown className="w-3 h-3 mr-1" />
              Fin
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSort("merchantName")}
              className={sortField === "merchantName" ? "bg-accent" : ""}
              data-testid="button-sort-merchant"
            >
              <ArrowUpDown className="w-3 h-3 mr-1" />
              Commercant
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Liste des Bons Plans ({filteredAndSortedPromotions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAndSortedPromotions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun bon plan trouve
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAndSortedPromotions.map((promo) => (
                <div
                  key={promo.id}
                  className="p-4 border rounded-md bg-card hover-elevate"
                  data-testid={`promo-card-${promo.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-medium truncate">{promo.title}</span>
                        {getStatusBadge(promo)}
                        <Badge variant="outline" style={{ padding: "2px 8px", fontSize: "11px" }}>
                          {getTypeLabel(promo.type)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Store className="w-3 h-3" />
                        <span>{promo.merchantName}</span>
                        <Tag className="w-3 h-3 ml-2" />
                        <span>{promo.merchantCategory}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(new Date(promo.startDate), "dd/MM/yyyy", { locale: fr })} - {format(new Date(promo.endDate), "dd/MM/yyyy", { locale: fr })}
                        </span>
                      </div>
                      {promo.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{promo.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => toggleActiveMutation.mutate({ id: promo.id, isActive: !promo.isActive })}
                        disabled={toggleActiveMutation.isPending}
                        data-testid={`button-toggle-${promo.id}`}
                      >
                        {promo.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => deletePromotionMutation.mutate(promo.id)}
                        disabled={deletePromotionMutation.isPending}
                        className="text-destructive"
                        data-testid={`button-delete-${promo.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
