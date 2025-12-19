import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, User, Store, CreditCard, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const getEntityIcon = (entityType: string) => {
  switch (entityType) {
    case "user":
      return User;
    case "merchant":
      return Store;
    case "transaction":
      return CreditCard;
    default:
      return Bell;
  }
};

const getActionColor = (action: string) => {
  if (action.includes("create")) return "default";
  if (action.includes("delete")) return "destructive";
  if (action.includes("update")) return "secondary";
  return "outline";
};

export function AuditLogViewer() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const auditLogs = logs || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="w-4 h-4" />
          Journal d'audit
        </CardTitle>
      </CardHeader>
      <CardContent>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune activite enregistree
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {auditLogs.map((log) => {
              const Icon = getEntityIcon(log.entityType);
              return (
                <div 
                  key={log.id}
                  className="flex items-start gap-3 p-2 bg-muted/50 rounded-md"
                  data-testid={`audit-log-${log.id}`}
                >
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getActionColor(log.action)} className="text-xs">
                        {log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{log.entityType}</span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{log.details}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(log.createdAt), { locale: fr, addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
