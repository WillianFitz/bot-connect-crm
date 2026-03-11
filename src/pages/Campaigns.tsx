import { mockCampaigns, mockFunnels, mockAgents } from "@/data/mock";
import { CampaignStatus } from "@/types";
import { Plus, Play, Pause, MoreHorizontal, Users, MessageSquare, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const statusConfig: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-success/20 text-success' },
  paused: { label: 'Pausada', className: 'bg-warning/20 text-warning' },
  completed: { label: 'Concluída', className: 'bg-muted text-muted-foreground' },
  draft: { label: 'Rascunho', className: 'bg-secondary text-muted-foreground' },
};

export default function Campaigns() {
  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <p className="text-sm text-muted-foreground">Gerencie suas campanhas de prospecção automática</p>
        </div>
        <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Nova Campanha</Button>
      </div>

      <div className="grid gap-4">
        {mockCampaigns.map(campaign => {
          const funnel = mockFunnels.find(f => f.id === campaign.funnelId);
          const agent = mockAgents.find(a => a.id === campaign.agentId);
          const progress = campaign.leadsCount > 0 ? (campaign.sentCount / campaign.leadsCount) * 100 : 0;
          const responseRate = campaign.sentCount > 0 ? Math.round((campaign.responseCount / campaign.sentCount) * 100) : 0;
          const config = statusConfig[campaign.status];

          return (
            <div key={campaign.id} className="rounded-xl border border-border/50 bg-card p-5 hover:border-primary/20 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground">{campaign.name}</h3>
                    <Badge variant="secondary" className={`text-[10px] ${config.className}`}>{config.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{campaign.targetAudience}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Funil: <span className="text-foreground">{funnel?.name}</span></span>
                    <span>Agente: <span className="text-foreground">{agent?.name}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {campaign.status === 'active' ? (
                    <Button variant="outline" size="icon" className="h-8 w-8 border-border/50"><Pause className="h-3.5 w-3.5" /></Button>
                  ) : campaign.status === 'paused' || campaign.status === 'draft' ? (
                    <Button variant="outline" size="icon" className="h-8 w-8 border-border/50"><Play className="h-3.5 w-3.5" /></Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">{campaign.leadsCount}</p>
                    <p className="text-[10px] text-muted-foreground">Leads</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-accent" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">{campaign.sentCount}</p>
                    <p className="text-[10px] text-muted-foreground">Enviadas</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <div>
                    <p className="text-lg font-semibold text-foreground">{responseRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Resposta</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Progresso</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
