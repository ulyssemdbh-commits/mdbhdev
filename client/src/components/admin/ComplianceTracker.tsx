import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, AlertTriangle, Loader2, Shield, FileText, CreditCard, Mail, Phone } from "lucide-react";

interface ComplianceStatus {
  merchantId: string;
  merchantName: string;
  hasSiret: boolean;
  hasIban: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  isComplete: boolean;
}

export function ComplianceTracker() {
  const { data: compliance, isLoading } = useQuery<ComplianceStatus[]>({
    queryKey: ["/api/admin/compliance"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const merchants = compliance || [];
  const completeCount = merchants.filter(m => m.isComplete).length;
  const incompleteCount = merchants.length - completeCount;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Conformite des commercants
        </CardTitle>
        <div className="flex gap-2">
          <Badge variant="default" className="text-xs">
            {completeCount} complets
          </Badge>
          {incompleteCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {incompleteCount} incomplets
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {merchants.map((merchant) => (
            <div 
              key={merchant.merchantId}
              className={`p-3 rounded-md ${merchant.isComplete ? 'bg-green-500/5' : 'bg-amber-500/5'}`}
              data-testid={`compliance-merchant-${merchant.merchantId}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{merchant.merchantName}</span>
                {merchant.isComplete ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={merchant.hasSiret ? "default" : "secondary"} className="text-xs gap-1">
                  <FileText className="w-3 h-3" />
                  SIRET
                  {merchant.hasSiret ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                </Badge>
                <Badge variant={merchant.hasIban ? "default" : "secondary"} className="text-xs gap-1">
                  <CreditCard className="w-3 h-3" />
                  IBAN
                  {merchant.hasIban ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                </Badge>
                <Badge variant={merchant.hasEmail ? "default" : "secondary"} className="text-xs gap-1">
                  <Mail className="w-3 h-3" />
                  Email
                  {merchant.hasEmail ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                </Badge>
                <Badge variant={merchant.hasPhone ? "default" : "secondary"} className="text-xs gap-1">
                  <Phone className="w-3 h-3" />
                  Tel
                  {merchant.hasPhone ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
