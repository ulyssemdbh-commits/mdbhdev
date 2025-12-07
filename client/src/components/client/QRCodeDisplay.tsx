import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";

interface QRCodeDisplayProps {
  clientId: string;
  clientName: string;
}

export function QRCodeDisplay({ clientId, clientName }: QRCodeDisplayProps) {
  const qrValue = `REV-CLIENT-${clientId}`;

  return (
    <Card className="border-card-border">
      <CardContent className="flex flex-col items-center p-6 gap-4">
        <div className="bg-white p-4 rounded-md">
          <QRCode
            value={qrValue}
            size={200}
            level="H"
            data-testid="qr-code-client"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-lg" data-testid="text-client-name">
            {clientName}
          </p>
          <p className="text-sm text-muted-foreground">
            Présentez ce code en caisse
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
