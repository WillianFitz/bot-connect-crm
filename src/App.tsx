import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Funnels from "./pages/Funnels";
import Campaigns from "./pages/Campaigns";
import Agents from "./pages/Agents";
import Appointments from "./pages/Appointments";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Connections from "./pages/Connections";
import Admin from "./pages/Admin";
import ClientLogin from "./pages/ClientLogin";
import AdminLogin from "./pages/AdminLogin";
import Tools from "./pages/Tools";

const queryClient = new QueryClient();

// Log simples apenas para forçar novo build/deploy no Pages
console.log("LeadFlowAI App carregado");

function AdminRoute() {
  const isLogged =
    typeof localStorage !== "undefined" &&
    localStorage.getItem("admin_logged") === "1";

  if (!isLogged) {
    return <Navigate to="/admin-login" replace />;
  }

  return <Admin />;
}

function ProtectedAppLayout() {
  const hasTenant =
    typeof localStorage !== "undefined" &&
    !!localStorage.getItem("tenant_id");

  if (!hasTenant) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="" element={<Dashboard />} />
        <Route path="connections" element={<Connections />} />
        <Route path="leads" element={<Leads />} />
        <Route path="crm" element={<Funnels />} />
        <Route path="tools" element={<Tools />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="agents" element={<Agents />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Login principal do sistema (clientes) */}
          <Route path="/" element={<ClientLogin />} />
          <Route path="/login" element={<ClientLogin />} />

          {/* Admin (fora do layout do app dos clientes) */}
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute />} />

          {/* App dos clientes, com sidebar/layout */}
          <Route
            path="/app/*"
            element={<ProtectedAppLayout />}
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
