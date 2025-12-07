import { useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import ClientDashboard from "@/pages/client-dashboard";
import MerchantDashboard from "@/pages/merchant-dashboard";
import AdminDashboard from "@/pages/admin-dashboard";

type UserRole = "none" | "client" | "merchant" | "admin";

function App() {
  const [currentRole, setCurrentRole] = useState<UserRole>("none");

  const handleSelectRole = (role: "client" | "merchant" | "admin") => {
    setCurrentRole(role);
  };

  const renderContent = () => {
    switch (currentRole) {
      case "client":
        return <ClientDashboard />;
      case "merchant":
        return <MerchantDashboard />;
      case "admin":
        return <AdminDashboard />;
      default:
        return <LandingPage onSelectRole={handleSelectRole} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        {renderContent()}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
