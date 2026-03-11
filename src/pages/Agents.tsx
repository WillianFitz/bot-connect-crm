import { mockAgents } from "@/data/mock";
import { Bot, Zap, Clock, Shield, MessageSquare, TrendingUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

export default function Agents() {
  const [agents, setAgents] = useState(mockAgents);

  const toggleAgent = (id: string) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, isActive: !a.isActive } : a));
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agentes de IA</h1>
        <p className="text-sm text-muted-foreground">Configure seus agentes de inteligência artificial</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {agents.map(agent => (
          <div key={agent.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <div className="p-5 border-b border-border/30">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl p-2.5 ${agent.type === 'attendance' ? 'bg-primary/10' : 'bg-accent/10'}`}>
                    <Bot className={`h-5 w-5 ${agent.type === 'attendance' ? 'text-primary' : 'text-accent'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground">{agent.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={agent.isActive ? 'bg-success/20 text-success text-[10px]' : 'text-[10px]'}>
                    {agent.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Switch checked={agent.isActive} onCheckedChange={() => toggleAgent(agent.id)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 border-b border-border/30">
              <div className="p-4 text-center border-r border-border/30">
                <MessageSquare className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
                <p className="text-lg font-bold text-foreground">{agent.conversationsCount}</p>
                <p className="text-[10px] text-muted-foreground">Conversas</p>
              </div>
              <div className="p-4 text-center border-r border-border/30">
                <TrendingUp className="mx-auto h-4 w-4 text-success mb-1" />
                <p className="text-lg font-bold text-foreground">{agent.successRate}%</p>
                <p className="text-[10px] text-muted-foreground">Sucesso</p>
              </div>
              <div className="p-4 text-center">
                <Zap className="mx-auto h-4 w-4 text-warning mb-1" />
                <p className="text-lg font-bold text-foreground">{agent.type === 'attendance' ? '72' : '85'}%</p>
                <p className="text-[10px] text-muted-foreground">Qualificação</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Delay Anti-Bot
                  </div>
                  <span className="text-sm font-medium text-primary">{agent.delayMinutes} min</span>
                </div>
                <Slider defaultValue={[agent.delayMinutes]} max={15} min={1} step={1} className="w-full" />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Detecção Anti-Bot
                </div>
                <Switch checked={agent.antibotEnabled} />
              </div>

              <Button variant="outline" className="w-full border-border/50 gap-2">
                <Settings className="h-4 w-4" /> Configurar Prompts
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Intenções detectáveis */}
      <div className="rounded-xl border border-border/50 bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Intenções Detectáveis pela IA</h3>
        <div className="flex flex-wrap gap-2">
          {['Interessado', 'Quer Preço', 'Quer Reunião', 'Não Interessado', 'Quer Mais Info', 'Pediu Retorno', 'Indicou Alguém'].map(intent => (
            <Badge key={intent} variant="outline" className="border-border/50 text-xs px-3 py-1">
              {intent}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
