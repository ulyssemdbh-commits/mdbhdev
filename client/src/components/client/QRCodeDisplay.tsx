import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";
import { QrCode } from "lucide-react";

interface QRCodeDisplayProps {
  revId: string;
  clientName: string;
}

export function QRCodeDisplay({ revId, clientName }: QRCodeDisplayProps) {
  return (
    <Card className="border-0 bg-gradient-to-br from-card to-muted/50 shadow-sm overflow-hidden">
      <CardContent className="flex flex-col items-center p-6 gap-4">
        <div className="flex items-center gap-2 text-primary">
          <QrCode className="w-5 h-5" />
          <p className="text-base font-semibold">QR-Code a presenter</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <QRCode
            value={revId}
            size={180}
            level="H"
            data-testid="qr-code-client"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-lg" data-testid="text-client-name">
            {clientName}
          </p>
          <p className="text-sm font-mono text-muted-foreground bg-muted px-3 py-1 rounded-md" data-testid="text-rev-id">
            {revId}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
