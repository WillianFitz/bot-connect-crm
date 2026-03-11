import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

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
                <Badge variant="secondary" className="text-[10px] bg-secondary">
                  {(leadsByColumn[column.id] || []).length}
                </Badge>
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
