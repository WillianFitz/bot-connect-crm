import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import ClientLogin from "./pages\ClientLogin";
import AdminLogin from "./pages\AdminLogin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<ClientLogin />} />
          <Route path="/login-admin" element={<AdminLogin />} />
          <Route
            path="/*"
            element={(
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/connections" element={<Connections />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/crm" element={<Funnels />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/agents" element={<Agents />} />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            )}
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
