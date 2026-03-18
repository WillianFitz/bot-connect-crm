import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, User, Plus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CrmColumn {
  id: number;
  name: string;
  position: number;
}

interface CrmLead {
  id: number;
  lead_id: number;
  column_id: number;
  position: number;
  company: string;
  phone: string;
  column_name: string;
}

const DEFAULT_COLUMNS = ["Leads", "Em contato", "Proposta", "Fechado"];

export default function Funnels() {
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const initializedRef = useRef(false);
  const [selectedColumnForNewLead, setSelectedColumnForNewLead] = useState<number | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [search, setSearch] = useState("");

  const columnsQuery = useQuery({
    queryKey: ["crm-columns"],
    queryFn: api.getCrmColumns,
  });

  const leadsQuery = useQuery({
    queryKey: ["crm-leads"],
    queryFn: api.getCrmLeads,
  });

  const allLeadsQuery = useQuery({
    queryKey: ["leads-for-crm"],
    queryFn: () => api.getLeads(),
  });

  const createColumn = useMutation({
    mutationFn: api.createCrmColumn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-columns"] });
    },
  });

  const moveLead = useMutation({
    mutationFn: api.moveCrmLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    },
  });

  const createLeadInCrm = useMutation({
    mutationFn: async (payload: { column_id: number; lead_id: number }) => {
      await api.createCrmLead({ lead_id: payload.lead_id, column_id: payload.column_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      setSelectedColumnForNewLead(null);
      setSelectedLeadId("");
    },
  });

  // Cria as colunas padrão se ainda não existir nenhuma
  useEffect(() => {
    if (columnsQuery.isSuccess && columnsQuery.data.length === 0 && !initializedRef.current) {
      initializedRef.current = true;
      DEFAULT_COLUMNS.forEach((name, index) => {
        createColumn.mutate({ name, position: index });
      });
    }
  }, [columnsQuery.isSuccess, columnsQuery.data, createColumn]);

  // Deduplica colunas por nome e mantém a ordem padrão (Leads, Em contato, Proposta, Fechado)
  const rawColumns = (columnsQuery.data || []) as CrmColumn[];
  const columnsMap = new Map<string, CrmColumn>();
  rawColumns
    .slice()
    .sort((a, b) => a.position - b.position)
    .forEach((c) => {
      const key = c.name.toLowerCase();
      if (!columnsMap.has(key)) {
        columnsMap.set(key, c);
      }
    });
  const columns = DEFAULT_COLUMNS.map((name) => {
    const key = name.toLowerCase();
    return columnsMap.get(key);
  }).filter(Boolean) as CrmColumn[];
  const crmLeads = (leadsQuery.data || []) as CrmLead[];

  const leadsByColumn = useMemo(() => {
    const map: Record<number, CrmLead[]> = {};
    columns.forEach((c) => {
      map[c.id] = [];
    });
    crmLeads.forEach((l) => {
      if (!map[l.column_id]) map[l.column_id] = [];
      map[l.column_id].push(l);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [columns, crmLeads]);

  const handleDropOnColumn = (columnId: number) => {
    if (draggingId == null) return;
    const columnLeads = leadsByColumn[columnId] || [];
    const newPosition = columnLeads.length ? columnLeads[columnLeads.length - 1].position + 1 : 0;
    moveLead.mutate({ id: draggingId, column_id: columnId, position: newPosition });
    setDraggingId(null);
  };

  const leadsAlreadyInCrmIds = new Set(crmLeads.map((l) => l.lead_id));
  const availableLeads = (allLeadsQuery.data || []).filter(
    (l) =>
      !leadsAlreadyInCrmIds.has(l.id) &&
      (l.company.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search)),
  );

  const deleteCrmLead = useMutation({
    mutationFn: api.deleteCrmLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    },
  });

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">CRM Kanban</h1>
          <p className="text-sm text-muted-foreground">
            Funil de Prospecção com colunas: Leads, Em contato, Proposta e Fechado. Arraste os cartões para mudar de etapa.
          </p>
        </div>
        <div className="w-full md:max-w-xs relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 bg-secondary border-border/50 h-9 text-xs"
            placeholder="Buscar lead por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[380px]">
        {columns.map((column) => (
          <div
            key={column.id}
            className="min-w-[280px] w-full flex-1 flex-shrink-0 xl:min-w-[320px] 2xl:min-w-[360px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropOnColumn(column.id)}
          >
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col h-full min-h-[320px]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <span className="text-sm font-medium text-foreground">
                  {column.name}
                </span>
                  <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] bg-secondary">
                    {(leadsByColumn[column.id] || []).length}
                  </Badge>
                  <Dialog
                    open={selectedColumnForNewLead === column.id}
                    onOpenChange={(open) => {
                      if (open) {
                        setSelectedColumnForNewLead(column.id);
                      } else {
                        setSelectedColumnForNewLead(null);
                        setSelectedLeadId("");
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <button className="h-6 w-6 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/60 text-xs">
                        <Plus className="h-3 w-3" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border/50 max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Adicionar lead em "{column.name}"</DialogTitle>
                      </DialogHeader>
                      <div className="mt-4 space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Selecionar lead existente
                          </Label>
                          <Select
                            value={selectedLeadId}
                            onValueChange={setSelectedLeadId}
                          >
                            <SelectTrigger className="mt-1 bg-secondary border-border/50 w-full">
                              <SelectValue placeholder={
                                availableLeads.length === 0
                                  ? "Nenhum lead disponível"
                                  : "Escolha um lead"
                              } />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border/50 max-h-64">
                              {availableLeads.length === 0 ? (
                                <SelectItem value="__none__" disabled>
                                  Nenhum lead disponível
                                </SelectItem>
                              ) : (
                                availableLeads.map((l) => (
                                  <SelectItem key={l.id} value={String(l.id)}>
                                    {l.company} • {l.phone}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <button
                          type="button"
                          className="mt-2 w-full inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          disabled={
                            !selectedLeadId ||
                            selectedLeadId === "__none__" ||
                            createLeadInCrm.isPending
                          }
                          onClick={() =>
                            selectedColumnForNewLead &&
                            createLeadInCrm.mutate({
                              column_id: selectedColumnForNewLead,
                              lead_id: Number(selectedLeadId),
                            })
                          }
                        >
                          {createLeadInCrm.isPending ? "Salvando..." : "Adicionar lead"}
                        </button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
              <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                {(leadsByColumn[column.id] || []).map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-lg border border-border/30 bg-secondary/50 p-3 cursor-grab hover:border-primary/30 transition-all group"
                    draggable
                    onDragStart={() => setDraggingId(lead.id)}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-foreground">
                            {lead.company}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {lead.phone}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 text-[10px]"
                          onClick={() => deleteCrmLead.mutate(lead.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                ))}
                {(leadsByColumn[column.id] || []).length === 0 && (
                  <p className="text-[11px] text-muted-foreground/70 text-center py-8">
                    Nenhum lead nesta coluna.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
