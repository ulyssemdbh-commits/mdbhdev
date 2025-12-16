import { useState } from "react";
import { MapPin, LogIn, Eye, EyeOff, Scan } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identifier.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer votre identifiant",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Erreur",
        description: "Le mot de passe doit contenir au moins 8 caractères",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    // For now, redirect to Replit auth as the main authentication method
    // In a production app, this would call a credentials-based auth endpoint
    toast({
      title: "Connexion",
      description: "Redirection vers l'authentification...",
    });
    
    setTimeout(() => {
      handleLogin();
    }, 500);
  };

  const handleFaceIDLogin = () => {
    toast({
      title: "Face ID",
      description: "Authentification biométrique en cours...",
    });
    
    // Simulate Face ID auth, then redirect to main auth
    setTimeout(() => {
      handleLogin();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">REV</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="container max-w-md px-4 py-8 space-y-6">
        <section className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Connexion</h1>
          <p className="text-muted-foreground">
            Connectez-vous pour accéder à votre espace
          </p>
        </section>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Identifiants</CardTitle>
            <CardDescription>
              Entrez vos identifiants pour vous connecter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCredentialsLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">Identifiant</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Votre identifiant ou email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  data-testid="input-identifier"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="8 caractères minimum"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Minimum 8 caractères
                </p>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={isLoading}
                data-testid="button-login-credentials"
              >
                <LogIn className="w-5 h-5" />
                {isLoading ? "Connexion..." : "Se connecter"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-sm text-muted-foreground">ou</span>
          <Separator className="flex-1" />
        </div>

        <Card>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              className="w-full gap-2"
              size="lg"
              onClick={handleFaceIDLogin}
              data-testid="button-login-faceid"
            >
              <Scan className="w-5 h-5" />
              Connexion Face ID
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <button
            onClick={handleLogin}
            className="text-primary font-medium"
            data-testid="link-signup"
          >
            Inscrivez-vous gratuitement
          </button>
        </p>
      </main>
    </div>
  );
}
