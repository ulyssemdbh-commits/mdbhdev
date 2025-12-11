import { MapPin, Store, Users, Wallet, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function LandingPage() {
  const features = [
    {
      icon: Wallet,
      title: "10% de cashback",
      description: "Sur chaque achat chez nos commerçants partenaires",
    },
    {
      icon: Store,
      title: "Commerce local",
      description: "Soutenez vos commerçants de quartier préférés",
    },
    {
      icon: Users,
      title: "Réseau solidaire",
      description: "Rejoignez une communauté engagée pour le local",
    },
  ];

  const benefits = [
    "Cashback utilisable dans tout le réseau",
    "Plus de 50 commerçants partenaires",
    "Bons plans exclusifs chaque semaine",
    "Application simple et gratuite",
  ];

  const handleLogin = () => {
    window.location.href = "/api/login";
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

      <main className="container max-w-lg px-4 py-8 space-y-8">
        <section className="text-center space-y-4">
          <h1 className="text-3xl font-bold leading-tight">
            Retour En Ville
          </h1>
          <p className="text-lg text-muted-foreground">
            Gagnez du cashback en soutenant vos commerçants locaux
          </p>
        </section>

        <section className="grid gap-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-card-border">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-md bg-primary/10 flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold text-center">Pourquoi REV ?</h2>
          <ul className="space-y-3">
            {benefits.map((benefit, index) => (
              <li key={index} className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 pt-4">
          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleLogin}
            data-testid="button-login"
          >
            Se connecter / S'inscrire
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Connectez-vous pour accéder à votre espace personnel
          </p>
        </section>

        <footer className="text-center text-sm text-muted-foreground pt-8 pb-4">
          <p>REV - Retour En Ville</p>
          <p>Soutenez le commerce local</p>
        </footer>
      </main>
    </div>
  );
}
