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
  Flame,
  Inbox,
  Lock,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const PLAN_RANK: Record<string, number> = { starter: 0, plus: 1, pro: 2 };

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  minPlan?: "starter" | "plus" | "pro";
};

const mainItems: NavItem[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Conexões", url: "/app/connections", icon: Link2 },
  { title: "Leads", url: "/app/leads", icon: Users },
  { title: "Mapa de Calor", url: "/app/heat-map", icon: Flame, minPlan: "pro" },
  { title: "CRM", url: "/app/crm", icon: GitBranch, minPlan: "pro" },
  { title: "Ferramentas", url: "/app/tools", icon: Wrench },
  { title: "Disparos", url: "/app/campaigns", icon: Megaphone },
];

const automationItems: NavItem[] = [
  { title: "Agentes de IA", url: "/app/agents", icon: Bot },
  { title: "Inbox", url: "/app/inbox", icon: Inbox },
  { title: "Funis", url: "/app/funnels", icon: Workflow, minPlan: "plus" },
  { title: "Agendamentos", url: "/app/appointments", icon: CalendarCheck, minPlan: "pro" },
];

const systemItems: NavItem[] = [
  { title: "Configurações", url: "/app/settings", icon: Settings },
];

function SidebarSection({
  label,
  items,
  plan,
}: {
  label: string;
  items: NavItem[];
  plan: string;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const rank = PLAN_RANK[plan] ?? 0;

  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="text-muted-foreground/60 text-[10px] uppercase tracking-widest">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const locked = item.minPlan ? rank < PLAN_RANK[item.minPlan] : false;
            if (locked) {
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <div
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
                      title={`Disponível no plano ${item.minPlan}`}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.title}</span>}
                      {!collapsed && <Lock className="h-3 w-3 shrink-0 opacity-50" />}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === "/" || item.url === "/app"}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    activeClassName="bg-sidebar-accent text-primary font-medium"
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  plus: "Plus",
  pro: "Pro",
};

const PLAN_LIMITS: Record<string, number> = {
  starter: 100,
  plus: 2000,
  pro: Infinity,
};

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

  const { data: planData } = useQuery({
    queryKey: ["tenant-plan"],
    queryFn: () => api.getTenantPlan(),
    staleTime: 5 * 60_000,
  });

  const leadsCount = countData?.count ?? 0;
  const plan = planData?.plan ?? "starter";
  const leadsLimit = PLAN_LIMITS[plan];

  return (
    <Sidebar collapsible="icon" className="border-r border-border/50">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-lg font-bold text-foreground">
              LeadFlow<span className="text-primary">AI</span>
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection label="Principal" items={mainItems} plan={plan} />
        <SidebarSection label="Automação" items={automationItems} plan={plan} />
        <SidebarSection label="Sistema" items={systemItems} plan={plan} />
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {!collapsed && (
          <div className="rounded-lg border border-border/40 bg-gradient-to-br from-secondary/80 to-secondary/40 p-3 space-y-2.5">
            {/* Plano badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  plan === "pro"
                    ? "bg-amber-500/20 border-amber-400/50 text-amber-300"
                    : plan === "plus"
                    ? "bg-blue-500/20 border-blue-400/50 text-blue-300"
                    : "bg-slate-500/20 border-slate-400/50 text-slate-300"
                }`}>
                  {plan === "pro" ? "👑" : plan === "plus" ? "⚡" : "🆓"} {PLAN_LABELS[plan] ?? "Starter"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {leadsLimit === Infinity ? "∞ leads" : `até ${leadsLimit.toLocaleString("pt-BR")}`}
              </span>
            </div>

            {/* Contador de leads */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold text-foreground leading-none">
                  {leadsCount.toLocaleString("pt-BR")}
                </span>
                {leadsLimit !== Infinity && (
                  <span className="text-[10px] text-muted-foreground">
                    / {leadsLimit.toLocaleString("pt-BR")} leads
                  </span>
                )}
                {leadsLimit === Infinity && (
                  <span className="text-[10px] text-muted-foreground">leads</span>
                )}
              </div>

              {/* Barra proporcional */}
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    leadsLimit !== Infinity && leadsCount / leadsLimit > 0.9
                      ? "bg-destructive"
                      : leadsLimit !== Infinity && leadsCount / leadsLimit > 0.7
                      ? "bg-amber-500"
                      : "bg-primary"
                  }`}
                  style={{
                    width: leadsLimit === Infinity
                      ? "0%"
                      : `${Math.min(100, (leadsCount / leadsLimit) * 100)}%`,
                  }}
                />
              </div>

              {leadsLimit !== Infinity && leadsCount / leadsLimit > 0.8 && (
                <p className="text-[10px] text-amber-400">
                  ⚠️ Quase no limite — considere fazer upgrade
                </p>
              )}
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
