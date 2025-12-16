import { MapPin, LogIn, Store, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Link } from "wouter";

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const roles = [
    {
      icon: User,
      title: "Client",
      description: "Gagnez du cashback sur vos achats",
    },
    {
      icon: Store,
      title: "Commerçant",
      description: "Gérez vos transactions et fidélisez vos clients",
    },
    {
      icon: Shield,
      title: "Administrateur",
      description: "Supervisez le réseau REV",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background">
        <Link href="/">
          <a className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">REV</span>
          </a>
        </Link>
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
            <CardTitle className="text-lg">Se connecter avec Replit</CardTitle>
            <CardDescription>
              Utilisez votre compte Replit pour vous connecter en toute sécurité
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleLogin}
              data-testid="button-login-replit"
            >
              <LogIn className="w-5 h-5" />
              Se connecter
            </Button>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground text-center">
            Accès selon votre rôle
          </h2>
          <div className="grid gap-3">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{role.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

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
