import { Users, TrendingUp, CalendarCheck, Megaphone, Target, BarChart3, Zap, UserCheck } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { dashboardStats, chartData } from "@/data/mock";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip, Funnel, FunnelChart, LabelList } from "recharts";

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua prospecção</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Leads" value={dashboardStats.totalLeads.toLocaleString()} change="+23 hoje" icon={Users} trend="up" />
        <StatCard title="Taxa de Resposta" value={`${dashboardStats.responseRate}%`} change="+2.4% vs semana passada" icon={TrendingUp} trend="up" />
        <StatCard title="Agendamentos" value={dashboardStats.schedulingRate + '%'} change="+5 esta semana" icon={CalendarCheck} trend="up" />
        <StatCard title="Conversão" value={`${dashboardStats.conversionRate}%`} change="+0.8% vs mês passado" icon={Target} trend="up" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Leads por dia */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Leads Capturados por Dia</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData.leadsByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
              <XAxis dataKey="day" stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(222, 30%, 16%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }} />
              <Bar dataKey="leads" radius={[6, 6, 0, 0]} fill="hsl(192, 91%, 52%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leads por origem */}
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Leads por Origem</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData.leadsByOrigin} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 16%)" />
              <XAxis type="number" stroke="hsl(215, 20%, 55%)" fontSize={12} />
              <YAxis dataKey="origin" type="category" stroke="hsl(215, 20%, 55%)" fontSize={12} width={80} />
              <Tooltip contentStyle={{ background: 'hsl(222, 47%, 8%)', border: '1px solid hsl(222, 30%, 16%)', borderRadius: '8px', color: 'hsl(210, 40%, 96%)' }} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {chartData.leadsByOrigin.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funil de vendas */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Funil de Vendas</h3>
        <div className="flex items-end justify-between gap-2 h-48">
          {chartData.funnelData.map((stage, i) => {
            const maxCount = chartData.funnelData[0].count;
            const heightPercent = (stage.count / maxCount) * 100;
            const colors = ['hsl(215,20%,55%)', 'hsl(192,91%,52%)', 'hsl(265,80%,60%)', 'hsl(38,92%,50%)', 'hsl(330,70%,55%)', 'hsl(192,70%,40%)', 'hsl(142,71%,45%)'];
            return (
              <div key={stage.stage} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{stage.count}</span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{ height: `${heightPercent}%`, backgroundColor: colors[i], minHeight: '8px' }}
                />
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{stage.stage}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
