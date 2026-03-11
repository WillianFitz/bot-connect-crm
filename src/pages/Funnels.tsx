import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, User, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

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
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const columnsQuery = useQuery({
    queryKey: ["crm-columns"],
    queryFn: api.getCrmColumns,
  });

  const leadsQuery = useQuery({
    queryKey: ["crm-leads"],
    queryFn: api.getCrmLeads,
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
    mutationFn: async (payload: { column_id: number; company: string; phone: string }) => {
      // cria lead simples sem pasta e vincula ao CRM
      const lead = await api.createLead({
        company: payload.company,
        phone: payload.phone,
        folder_id: null,
      });
      await api.createCrmLead({ lead_id: lead.id, column_id: payload.column_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      setSelectedColumnForNewLead(null);
      setNewCompany("");
      setNewPhone("");
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

  const columns = (columnsQuery.data || []).slice().sort((a, b) => a.position - b.position) as CrmColumn[];
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

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRM Kanban</h1>
        <p className="text-sm text-muted-foreground">
          Funil de Prospecção com colunas: Leads, Em contato, Proposta e Fechado. Arraste os cartões para mudar de etapa.
        </p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <div
            key={column.id}
            className="min-w-[280px] max-w-[280px] flex-shrink-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropOnColumn(column.id)}
          >
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
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
                          <Label className="text-xs text-muted-foreground">Empresa</Label>
                          <Input
                            className="mt-1 bg-secondary border-border/50"
                            value={newCompany}
                            onChange={(e) => setNewCompany(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Telefone</Label>
                          <Input
                            className="mt-1 bg-secondary border-border/50"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          className="mt-2 w-full inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          disabled={!newCompany || !newPhone || createLeadInCrm.isPending}
                          onClick={() =>
                            selectedColumnForNewLead &&
                            createLeadInCrm.mutate({
                              column_id: selectedColumnForNewLead,
                              company: newCompany,
                              phone: newPhone,
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
              <div className="p-2 space-y-2 max-h-[500px] overflow-y-auto">
                {(leadsByColumn[column.id] || []).map((lead) => (
                  <div
                    key={lead.id}
                    className="rounded-lg border border-border/30 bg-secondary/50 p-3 cursor-grab hover:border-primary/30 transition-all group"
                    draggable
                    onDragStart={() => setDraggingId(lead.id)}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <div className="flex items-start justify-between">
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
                      <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground" />
                    </div>
                  </div>
                ))}
                {(leadsByColumn[column.id] || []).length === 0 && (
                  <p className="text-[11px] text-muted-foreground/70 text-center py-4">
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
