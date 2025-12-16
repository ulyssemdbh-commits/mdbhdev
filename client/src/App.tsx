import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import ClientDashboard from "@/pages/client-dashboard";
import MerchantDashboard from "@/pages/merchant-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";
import { Loader2 } from "lucide-react";

function ProtectedRoute({ allowedRoles, children }: { allowedRoles: string[], children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const role = (user as any)?.role || "client";
  if (!allowedRoles.includes(role)) {
    return <NotFound />;
  }

  return <>{children}</>;
}

function Router() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const role = (user as any)?.role || "client";

  switch (role) {
    case "merchant":
      return <MerchantDashboard />;
    case "admin":
      return <AdminDashboard />;
    default:
      return <ClientDashboard />;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Switch>
          <Route path="/" component={Router} />
          <Route path="/login" component={LoginPage} />
          <Route path="/Admin">
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          </Route>
          <Route path="/merchant">
            <ProtectedRoute allowedRoles={["merchant"]}>
              <MerchantDashboard />
            </ProtectedRoute>
          </Route>
          <Route path="/client">
            <ProtectedRoute allowedRoles={["client"]}>
              <ClientDashboard />
            </ProtectedRoute>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
