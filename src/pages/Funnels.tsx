import { useState } from "react";
import { mockFunnels, mockLeads } from "@/data/mock";
import { Funnel } from "@/types";
import { Plus, GripVertical, MoreHorizontal, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Funnels() {
  const [selectedFunnel, setSelectedFunnel] = useState<string>(mockFunnels[0].id);
  const funnel = mockFunnels.find(f => f.id === selectedFunnel)!;

  // Assign leads to stages for demo
  const stageLeads: Record<string, typeof mockLeads> = {};
  funnel.stages.forEach(s => { stageLeads[s.id] = []; });
  mockLeads.forEach((lead, i) => {
    const stageIdx = i % funnel.stages.length;
    const stageId = funnel.stages[stageIdx].id;
    stageLeads[stageId].push(lead);
  });

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Funis</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus funis de prospecção</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
            <SelectTrigger className="w-[220px] bg-secondary border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border/50">
              {mockFunnels.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Novo Funil</Button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {funnel.stages.map(stage => (
          <div key={stage.id} className="min-w-[280px] max-w-[280px] flex-shrink-0">
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="text-sm font-medium text-foreground">{stage.name}</span>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-secondary">
                  {stageLeads[stage.id]?.length || 0}
                </Badge>
              </div>
              <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                {(stageLeads[stage.id] || []).map(lead => (
                  <div key={lead.id} className="rounded-lg border border-border/30 bg-secondary/50 p-3 cursor-grab hover:border-primary/30 transition-all group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">{lead.name}</p>
                          <p className="text-[10px] text-muted-foreground">{lead.company}</p>
                        </div>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground" />
                    </div>
                    <div className="mt-2 flex gap-1">
                      {lead.tags.slice(0, 2).map(t => (
                        <Badge key={t} variant="outline" className="text-[9px] border-border/50 px-1.5 py-0">{t}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        <div className="min-w-[280px] max-w-[280px] flex-shrink-0 flex items-center justify-center">
          <button className="rounded-xl border-2 border-dashed border-border/30 p-8 hover:border-primary/30 transition-colors w-full">
            <Plus className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-xs text-muted-foreground/50">Nova Etapa</p>
          </button>
        </div>
      </div>
    </div>
  );
}
