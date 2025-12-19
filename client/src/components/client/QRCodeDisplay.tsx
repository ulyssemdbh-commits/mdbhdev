import QRCode from "react-qr-code";
import { Card, CardContent } from "@/components/ui/card";

interface QRCodeDisplayProps {
  revId: string;
  clientName: string;
}

export function QRCodeDisplay({ revId, clientName }: QRCodeDisplayProps) {
  return (
    <Card className="border-card-border">
      <CardContent className="flex flex-col items-center p-6 gap-4">
        <p className="text-[#db0000] text-[18px] font-bold">QR-Code à présenter</p>
        <div className="bg-white p-4 rounded-md">
          <QRCode
            value={revId}
            size={200}
            level="H"
            data-testid="qr-code-client"
          />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-lg" data-testid="text-client-name">
            {clientName}
          </p>
          <p className="text-sm font-mono text-[#ffffff]" data-testid="text-rev-id">
            {revId}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
