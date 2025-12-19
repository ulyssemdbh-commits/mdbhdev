import { MapPin, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "@/components/client/NotificationBell";

interface HeaderProps {
  title?: string;
  showLogout?: boolean;
  showNotifications?: boolean;
  onLogout?: () => void;
}

export function Header({ title = "REV", showLogout = true, showNotifications = true, onLogout }: HeaderProps) {
  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    }
    try {
      await fetch("/api/logout", { method: "POST", credentials: "include" });
    } catch (error) {
      console.error("Logout error:", error);
    }
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-3 border-b bg-background">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
          <MapPin className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {showNotifications && <NotificationBell />}
        <ThemeToggle />
        {showLogout && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        )}
      </div>
    </header>
  );
}
