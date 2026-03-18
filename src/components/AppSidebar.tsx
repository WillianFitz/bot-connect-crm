import {
  LayoutDashboard,
  Users,
  GitBranch,
  Megaphone,
  Bot,
  CalendarCheck,
  Settings,
  Zap,
  Link2,
  Wrench,
  Workflow,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Conexões", url: "/app/connections", icon: Link2 },
  { title: "Leads", url: "/app/leads", icon: Users },
  { title: "CRM", url: "/app/crm", icon: GitBranch },
  { title: "Ferramentas", url: "/app/tools", icon: Wrench },
  { title: "Disparos", url: "/app/campaigns", icon: Megaphone },
];

const automationItems = [
  { title: "Agentes de IA", url: "/app/agents", icon: Bot },
  { title: "Funis", url: "/app/funnels", icon: Workflow },
  { title: "Agendamentos", url: "/app/appointments", icon: CalendarCheck },
];

const systemItems = [
  { title: "Configurações", url: "/app/settings", icon: Settings },
];

function SidebarSection({ label, items }: { label: string; items: typeof mainItems }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <SidebarGroup>
      {!collapsed && <SidebarGroupLabel className="text-muted-foreground/60 text-[10px] uppercase tracking-widest">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors" activeClassName="bg-sidebar-accent text-primary font-medium">
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("tenant_id");
    navigate("/login");
  }
  const { data: countData } = useQuery({
    queryKey: ["leads-count"],
    queryFn: () => api.getLeadsCount(),
    staleTime: 60_000,
  });
  const leadsCount = countData?.count ?? 0;

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && <span className="text-lg font-bold text-foreground">LeadFlow<span className="text-primary">AI</span></span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection label="Principal" items={mainItems} />
        <SidebarSection label="Automação" items={automationItems} />
        <SidebarSection label="Sistema" items={systemItems} />
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {!collapsed && (
          <div className="rounded-lg border border-border/50 bg-secondary/50 p-3">
            <p className="text-[11px] text-muted-foreground">
              Plano Pro • {leadsCount.toLocaleString("pt-BR")} leads
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${Math.min(100, (leadsCount / 2000) * 100)}%` }}
              />
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
