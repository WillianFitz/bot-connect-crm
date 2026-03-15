import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Phone,
  Send,
  MessageCircle,
  Megaphone,
  TrendingUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "@/lib/api";
import { StatCard } from "@/components/StatCard";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--primary) / 0.8)", "hsl(var(--primary) / 0.6)"];

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: api.getDashboardStats,
  });
  const { data: whatsapp, isLoading: waLoading } = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: api.getWhatsappConnection,
  });

  const waConnected = whatsapp?.status === "connected";
  const waStatus = waLoading ? "..." : waConnected ? "Conectado" : "Desconectado";

  if (statsError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-sm text-muted-foreground">Não foi possível carregar o dashboard.</p>
      </div>
    );
  }

  if (statsLoading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const chartData = stats.leadsLast7Days.map((d) => ({
    day: formatDay(d.date),
    leads: d.count,
    full: d.date,
  }));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Visão geral dos seus leads e campanhas
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de leads"
          value={stats.leadsTotal.toLocaleString("pt-BR")}
          icon={Users}
          change={stats.leadsTotal === 0 ? "Nenhum lead ainda" : undefined}
        />
        <StatCard
          title="Leads com telefone"
          value={stats.leadsWithPhone.toLocaleString("pt-BR")}
          icon={Phone}
          change={
            stats.leadsTotal > 0
              ? `${Math.round((stats.leadsWithPhone / stats.leadsTotal) * 100)}% da base`
              : undefined
          }
        />
        <StatCard
          title="Mensagens enviadas"
          value={stats.totalSent.toLocaleString("pt-BR")}
          icon={Send}
          change={
            stats.totalErrors > 0
              ? `${stats.totalErrors} erro(s)`
              : stats.totalSent > 0
                ? "Campanhas"
                : undefined
          }
          trend={stats.totalErrors > 0 ? "down" : undefined}
        />
        <StatCard
          title="WhatsApp"
          value={waStatus}
          icon={MessageCircle}
          change={waConnected ? "Pronto para disparos" : "Conecte em Conexões"}
          trend={waConnected ? "up" : "down"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Leads capturados (últimos 7 dias)
          </h3>
          {chartData.some((d) => d.leads > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.full
                      ? new Date(payload[0].payload.full).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                        })
                      : ""
                  }
                />
                <Bar dataKey="leads" radius={[6, 6, 0, 0]} name="Leads">
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
              <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhum lead nos últimos 7 dias</p>
              <Link to="/app/leads">
                <Button variant="outline" size="sm" className="mt-3">
                  Cadastrar leads
                </Button>
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Campanhas</h3>
            <Link to="/app/campaigns">
              <Button variant="ghost" size="sm">
                Ver todas
              </Button>
            </Link>
          </div>
          {stats.campaigns.length > 0 ? (
            <ul className="space-y-3">
              {stats.campaigns.slice(0, 5).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Megaphone className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-medium truncate">{c.name}</span>
                    <span
                      className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        c.status === "active"
                          ? "bg-green-500/20 text-green-600 dark:text-green-400"
                          : c.status === "completed"
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {c.status === "active" ? "Ativa" : c.status === "completed" ? "Concluída" : "Pausada"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {c.sent}/{c.total_leads || "—"} enviados
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center h-[260px] text-muted-foreground">
              <Megaphone className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma campanha criada</p>
              <Link to="/app/campaigns">
                <Button variant="outline" size="sm" className="mt-3">
                  Criar campanha
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Resumo rápido</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
          <div>
            <p className="text-muted-foreground">Campanhas</p>
            <p className="text-xl font-semibold text-foreground">
              {stats.campaignsActive} ativas / {stats.campaignsTotal}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total enviados</p>
            <p className="text-xl font-semibold text-foreground">{stats.totalSent}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Erros de envio</p>
            <p className="text-xl font-semibold text-foreground">{stats.totalErrors}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Base para disparo</p>
            <p className="text-xl font-semibold text-foreground">{stats.leadsWithPhone} leads</p>
          </div>
        </div>
      </div>
    </div>
  );
}
