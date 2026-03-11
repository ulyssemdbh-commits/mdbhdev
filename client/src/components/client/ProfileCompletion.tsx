import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarIcon, User, Loader2, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ProfileCompletionProps {
  onComplete: () => void;
}

export function ProfileCompletion({ onComplete }: ProfileCompletionProps) {
  const [dateOfBirth, setDateOfBirth] = useState("");
  const { toast } = useToast();

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { dateOfBirth: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/user/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Profil mis à jour",
        description: "Votre date de naissance a été enregistrée.",
      });
      onComplete();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour votre profil.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateOfBirth) {
      toast({
        title: "Date requise",
        description: "Veuillez entrer votre date de naissance.",
        variant: "destructive",
      });
      return;
    }

    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    
    if (age < 16) {
      toast({
        title: "Âge minimum requis",
        description: "Vous devez avoir au moins 16 ans pour utiliser REV.",
        variant: "destructive",
      });
      return;
    }

    updateProfileMutation.mutate({ dateOfBirth });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Complétez votre profil</CardTitle>
          <CardDescription>
            Pour créer votre compte REV, nous avons besoin de votre date de naissance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Date de naissance
              </Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                required
                data-testid="input-date-of-birth"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={updateProfileMutation.isPending}
              data-testid="button-submit-profile"
            >
              {updateProfileMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Continuer"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full gap-2 text-muted-foreground"
              onClick={async () => {
                try {
                  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
                } catch (e) {}
                window.location.href = "/login";
              }}
              data-testid="button-logout-profile"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
