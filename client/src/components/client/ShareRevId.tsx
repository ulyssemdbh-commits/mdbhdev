import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";
import { SiWhatsapp, SiFacebook, SiX } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

interface ShareRevIdProps {
  revId: string;
  clientName: string;
}

export function ShareRevId({ revId, clientName }: ShareRevIdProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const shareMessage = `Rejoins REV et envoie-moi du cashback avec mon code: ${revId}`;
  const shareUrl = `https://rev.app/join?ref=${revId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareMessage}\n${shareUrl}`);
      setCopied(true);
      toast({
        title: "Copie",
        description: "Votre code REVid a ete copie",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de copier",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (platform: string) => {
    const encodedMessage = encodeURIComponent(shareMessage);
    const encodedUrl = encodeURIComponent(shareUrl);
    
    let url = "";
    switch (platform) {
      case "whatsapp":
        url = `https://wa.me/?text=${encodedMessage}`;
        break;
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedMessage}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodedMessage}`;
        break;
      case "sms":
        url = `sms:?body=${encodedMessage}`;
        break;
    }
    
    if (url) {
      window.open(url, "_blank");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-share-revid">
          <Share2 className="w-4 h-4" />
          Partager
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Partagez votre code REVid</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="bg-primary/5">
            <CardContent className="pt-4">
              <p className="text-center text-2xl font-mono font-bold">{revId}</p>
              <p className="text-center text-sm text-muted-foreground mt-2">
                Partagez ce code pour recevoir du cashback
              </p>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-4 gap-2">
            <Button
              variant="outline"
              className="flex-col gap-1 h-auto py-3"
              onClick={() => handleShare("whatsapp")}
              data-testid="button-share-whatsapp"
            >
              <SiWhatsapp className="w-5 h-5 text-green-500" />
              <span className="text-xs">WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col gap-1 h-auto py-3"
              onClick={() => handleShare("facebook")}
              data-testid="button-share-facebook"
            >
              <SiFacebook className="w-5 h-5 text-blue-600" />
              <span className="text-xs">Facebook</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col gap-1 h-auto py-3"
              onClick={() => handleShare("twitter")}
              data-testid="button-share-twitter"
            >
              <SiX className="w-5 h-5" />
              <span className="text-xs">X</span>
            </Button>
            <Button
              variant="outline"
              className="flex-col gap-1 h-auto py-3"
              onClick={() => handleShare("sms")}
              data-testid="button-share-sms"
            >
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <span className="text-xs">SMS</span>
            </Button>
          </div>
          
          <Button 
            variant="secondary" 
            className="w-full gap-2" 
            onClick={handleCopy}
            data-testid="button-copy-revid"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copie !" : "Copier le code"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
