import { LogOut, User, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface AccountSectionProps {
  user: {
    id?: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
    role?: string;
  } | null;
  showRole?: boolean;
}

export function AccountSection({ user, showRole = false }: AccountSectionProps) {
  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    window.location.href = "/";
  };

  const displayName = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Utilisateur"
    : "Utilisateur";

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleLabels: Record<string, string> = {
    client: "Client",
    merchant: "Commerçant",
    admin: "Administrateur",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5" />
          Mon Compte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14">
            {user?.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={displayName} />}
            <AvatarFallback className="text-lg bg-primary/10 text-primary">
              {initials || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-lg truncate" data-testid="text-user-name">
              {displayName}
            </p>
            {user?.email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate" data-testid="text-user-email">{user.email}</span>
              </p>
            )}
            {showRole && user?.role && (
              <Badge variant="secondary" className="mt-1">
                <Shield className="w-3 h-3 mr-1" />
                {roleLabels[user.role] || user.role}
              </Badge>
            )}
          </div>
        </div>

        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={handleLogout}
          data-testid="button-logout-account"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </Button>
      </CardContent>
    </Card>
  );
}
