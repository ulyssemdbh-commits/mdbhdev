import { useState, useRef, useEffect } from "react";
import { Camera, X, Keyboard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QRScannerProps {
  onScanSuccess: (clientId: string) => void;
  onCancel?: () => void;
}

export function QRScanner({ onScanSuccess, onCancel }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(true);
  const [manualInput, setManualInput] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (!isScanning || showManualInput) return;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.log("Camera access denied or not available");
        setShowManualInput(true);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isScanning, showManualInput]);

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScanSuccess(manualInput.trim());
    }
  };

  const simulateScan = () => {
    // todo: remove mock functionality
    const mockClientId = "CLT-" + Math.random().toString(36).substr(2, 9).toUpperCase();
    onScanSuccess(mockClientId);
  };

  if (showManualInput) {
    return (
      <Card className="border-card-border">
        <CardContent className="p-6 space-y-4">
          <div className="text-center space-y-2">
            <Keyboard className="w-12 h-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold text-lg">Saisie manuelle</h3>
            <p className="text-sm text-muted-foreground">
              Entrez le code client manuellement
            </p>
          </div>
          <div className="space-y-3">
            <Input
              placeholder="Code client (ex: CLT-ABC123)"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              data-testid="input-manual-client-code"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowManualInput(false)}
                data-testid="button-back-to-scan"
              >
                Retour au scan
              </Button>
              <Button
                className="flex-1"
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
                data-testid="button-submit-manual-code"
              >
                Valider
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-card-border overflow-hidden">
      <CardContent className="p-0">
        <div className="relative aspect-square bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-white rounded-lg relative">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
            </div>
          </div>
          <div className="absolute top-4 left-0 right-0 text-center">
            <p className="text-white text-sm font-medium bg-black/50 inline-block px-3 py-1 rounded-full">
              Scannez le QR code client
            </p>
          </div>
          {onCancel && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-4 right-4 text-white hover:bg-white/20"
              onClick={onCancel}
              data-testid="button-cancel-scan"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
        <div className="p-4 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => setShowManualInput(true)}
            data-testid="button-manual-entry"
          >
            <Keyboard className="w-4 h-4" />
            Saisie manuelle
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={simulateScan}
            data-testid="button-simulate-scan"
          >
            <Camera className="w-4 h-4" />
            Simuler scan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
