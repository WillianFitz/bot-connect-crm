import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GripVertical, User, Plus, Search, X, Settings2, Trash2,
  Flame, AlertTriangle, Zap, Thermometer, Snowflake, Clock,
  Check, DollarSign,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CrmColumn {
  id: number;
  name: string;
  position: number;
  color: string | null;
  wip_limit: number | null;
}

interface CrmLead {
  id: number;
  lead_id: number;
  column_id: number;
  position: number;
  company: string;
  phone: string;
  column_name: string;
  tags: string | null;
  deal_value: number | null;
  notes: string | null;
  assignee: string | null;
  moved_at: string | null;
  heat_score: number | null;
  heat_label: "cold" | "warm" | "hot" | "fire" | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS = ["Leads", "Em contato", "Proposta", "Fechado"];
const DEFAULT_COLORS  = ["#6366f1", "#3b82f6", "#22c55e", "#f59e0b"];

const COLUMN_COLORS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#22c55e",
  "#f59e0b", "#f97316", "#ef4444", "#ec4899",
  "#a855f7", "#6b7280",
];

const HEAT_CONFIG = {
  fire: { label: "Em Chamas", Icon: Zap,        cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  hot:  { label: "Quente",   Icon: Flame,       cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  warm: { label: "Morno",    Icon: Thermometer, cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  cold: { label: "Frio",     Icon: Snowflake,   cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function daysInColumn(movedAt: string | null): number {
  if (!movedAt) return 0;
  const utc = movedAt.endsWith("Z") || movedAt.includes("+") ? movedAt : movedAt + "Z";
  return Math.floor((Date.now() - new Date(utc).getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── LeadCard ───────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  colColor,
  onClick,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  lead: CrmLead;
  colColor: string | null;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete: () => void;
}) {
  const tags   = parseTags(lead.tags);
  const days   = daysInColumn(lead.moved_at);
  const heat   = lead.heat_label ? HEAT_CONFIG[lead.heat_label] : null;
  const accent = colColor ?? "#6366f1";
  const staleCls = days > 7 ? "text-red-400" : days > 3 ? "text-amber-400" : "text-muted-foreground/40";

  return (
    <div
      className="group rounded-lg border border-border/30 bg-card/70 hover:bg-card transition-all cursor-pointer hover:shadow-sm select-none"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-start gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full shrink-0 mt-0.5"
            style={{ backgroundColor: accent + "22" }}
          >
            <User className="h-3.5 w-3.5" style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate leading-tight">{lead.company}</p>
            <p className="text-[10px] text-muted-foreground truncate">{lead.phone}</p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <X className="h-3 w-3" />
            </button>
            <GripVertical className="h-4 w-4 text-muted-foreground/30" />
          </div>
        </div>

        {/* Heat badge */}
        {heat && lead.heat_score != null && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 w-fit ${heat.cls}`}>
            <heat.Icon className="h-2.5 w-2.5 mr-0.5" />
            {lead.heat_score}/10 · {heat.label}
          </Badge>
        )}

        {/* Tags (max 2 visible) */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0 rounded-md bg-primary/10 text-primary border border-primary/20 font-medium"
              >
                {tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] px-1.5 py-0 rounded-md bg-muted/40 text-muted-foreground border border-border/30">
                +{tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Deal value + assignee + days */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {lead.deal_value != null && lead.deal_value > 0 && (
              <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-0.5">
                <DollarSign className="h-2.5 w-2.5" />
                {formatCurrency(lead.deal_value)}
              </span>
            )}
            {lead.assignee && (
              <span className="text-[10px] text-muted-foreground/60 truncate">{lead.assignee}</span>
            )}
          </div>
          {days > 3 && (
            <div className={`flex items-center gap-0.5 text-[10px] shrink-0 ${staleCls}`}>
              <Clock className="h-2.5 w-2.5" />
              {days}d
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── LeadDetailDialog ───────────────────────────────────────────────────────────

function LeadDetailDialog({
  lead,
  columns,
  open,
  onClose,
  onMoveColumn,
}: {
  lead: CrmLead | null;
  columns: CrmColumn[];
  open: boolean;
  onClose: () => void;
  onMoveColumn: (crmLeadId: number, newColumnId: number) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tags, setTags]           = useState<string[]>([]);
  const [tagInput, setTagInput]   = useState("");
  const [dealValue, setDealValue] = useState("");
  const [assignee, setAssignee]   = useState("");
  const [notes, setNotes]         = useState("");
  const [targetCol, setTargetCol] = useState("");

  useEffect(() => {
    if (lead) {
      setTags(parseTags(lead.tags));
      setDealValue(lead.deal_value != null ? String(lead.deal_value) : "");
      setAssignee(lead.assignee ?? "");
      setNotes(lead.notes ?? "");
      setTargetCol(String(lead.column_id));
      setTagInput("");
    }
  }, [lead?.id]);

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.updateCrmLeadMeta>[1]) =>
      api.updateCrmLeadMeta(lead!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      toast({ title: "Lead atualizado" });
      onClose();
    },
    onError: () => toast({ title: "Erro ao salvar", variant: "destructive" }),
  });

  if (!lead) return null;

  const heat = lead.heat_label ? HEAT_CONFIG[lead.heat_label] : null;
  const days = daysInColumn(lead.moved_at);

  const handleSave = () => {
    const raw    = dealValue.trim().replace(/[R$\s.]/g, "").replace(",", ".");
    const parsed = raw ? parseFloat(raw) : null;
    updateMutation.mutate({
      tags,
      deal_value: parsed != null && !isNaN(parsed) ? parsed : null,
      notes:    notes.trim() || null,
      assignee: assignee.trim() || null,
    });
    const newColId = Number(targetCol);
    if (newColId !== lead.column_id) {
      onMoveColumn(lead.id, newColId);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border/50 max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            {lead.company}
            {heat && (
              <Badge variant="outline" className={`text-[10px] ml-1 ${heat.cls}`}>
                <heat.Icon className="h-2.5 w-2.5 mr-0.5" />
                {lead.heat_score}/10
              </Badge>
            )}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{lead.phone}</p>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Etapa + Valor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Etapa do pipeline</Label>
              <Select value={targetCol} onValueChange={setTargetCol}>
                <SelectTrigger className="h-8 text-xs bg-secondary border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border/50">
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={String(col.id)} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: col.color ?? "#6366f1" }}
                        />
                        {col.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Valor do negócio</Label>
              <Input
                className="h-8 text-xs bg-secondary border-border/50"
                placeholder="Ex: 1500"
                value={dealValue}
                onChange={(e) => setDealValue(e.target.value)}
              />
            </div>
          </div>

          {/* Responsável */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Responsável</Label>
            <Input
              className="h-8 text-xs bg-secondary border-border/50"
              placeholder="Nome do responsável..."
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </div>

          {/* Tags */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tags</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
                  >
                    {tag}
                    <button
                      className="ml-0.5 hover:text-destructive"
                      onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-1">
              <Input
                className="h-7 text-xs bg-secondary border-border/50 flex-1"
                placeholder="Nova tag... (Enter para adicionar)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={addTag}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Notas</Label>
            <textarea
              className="w-full rounded-md border border-border/50 bg-secondary text-xs p-2 min-h-[80px] resize-none focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
              placeholder="Observações sobre este lead..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Time in column warning */}
          {days > 0 && (
            <div className={`flex items-center gap-1.5 text-[11px] rounded-md px-2.5 py-1.5 ${
              days > 7
                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                : days > 3
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-muted/30 text-muted-foreground/60"
            }`}>
              <Clock className="h-3 w-3 shrink-0" />
              {days === 1 ? "1 dia" : `${days} dias`} nesta etapa
              {days > 7 && <span className="font-semibold ml-1">— lead parado!</span>}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 border-t border-border/20">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Cancelar
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSave} disabled={updateMutation.isPending}>
              <Check className="h-3 w-3" />
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── ColumnSettingsDialog ───────────────────────────────────────────────────────

function ColumnSettingsDialog({
  column,
  open,
  onClose,
  onSave,
  onDelete,
  leadCount,
}: {
  column: CrmColumn | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, data: { name: string; color: string; wip_limit: number | null }) => void;
  onDelete: (id: number) => void;
  leadCount: number;
}) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState("#6366f1");
  const [wip, setWip]     = useState("");

  useEffect(() => {
    if (column) {
      setName(column.name);
      setColor(column.color ?? "#6366f1");
      setWip(column.wip_limit != null ? String(column.wip_limit) : "");
    }
  }, [column?.id]);

  if (!column) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border/50 max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-sm">Configurar coluna</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Nome</Label>
            <Input
              className="h-8 text-xs bg-secondary border-border/50"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Cor da coluna</Label>
            <div className="flex flex-wrap gap-2">
              {COLUMN_COLORS.map((c) => (
                <button
                  key={c}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-offset-card ring-white/50 scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Limite WIP{" "}
              <span className="text-muted-foreground/50">(máx. leads simultâneos)</span>
            </Label>
            <Input
              className="h-8 text-xs bg-secondary border-border/50"
              type="number"
              min={0}
              placeholder="Sem limite"
              value={wip}
              onChange={(e) => setWip(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
              disabled={leadCount > 0}
              title={leadCount > 0 ? "Mova todos os leads antes de deletar" : "Deletar coluna"}
              onClick={() => { onDelete(column.id); onClose(); }}
            >
              <Trash2 className="h-3 w-3" />
              Deletar
            </Button>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  onSave(column.id, {
                    name:      name.trim() || column.name,
                    color,
                    wip_limit: wip ? Number(wip) : null,
                  });
                  onClose();
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── AddLeadDialog ──────────────────────────────────────────────────────────────

function AddLeadDialog({
  column,
  open,
  onClose,
  availableLeads,
  onAdd,
  isPending,
}: {
  column: CrmColumn | null;
  open: boolean;
  onClose: () => void;
  availableLeads: Array<{ id: number; company: string; phone: string }>;
  onAdd: (leadId: number) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    if (open) { setSelected(null); setSearch(""); }
  }, [open]);

  if (!column) return null;

  const filtered = availableLeads.filter(
    (l) =>
      l.company.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search),
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-card border-border/50 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: column.color ?? "#6366f1" }}
            />
            Adicionar lead em "{column.name}"
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-1">
          <Input
            className="h-8 text-xs bg-secondary border-border/50"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-52 overflow-y-auto rounded-md border border-border/30 divide-y divide-border/20">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum lead disponível</p>
            ) : (
              filtered.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setSelected(l.id)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    selected === l.id
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-secondary text-foreground"
                  }`}
                >
                  <p className="text-xs font-medium truncate">{l.company}</p>
                  <p className="text-[10px] text-muted-foreground">{l.phone}</p>
                </button>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={selected == null || isPending}
              onClick={() => selected != null && onAdd(selected)}
            >
              {isPending ? "Adicionando..." : "Adicionar lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Funnels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const initializedRef = useRef(false);

  // UI state
  const [search, setSearch]               = useState("");
  const [draggingId, setDraggingId]       = useState<number | null>(null);
  const [dragOverCol, setDragOverCol]     = useState<number | null>(null);
  const [editingColumn, setEditingColumn] = useState<CrmColumn | null>(null);
  const [addLeadCol, setAddLeadCol]       = useState<CrmColumn | null>(null);
  const [openLeadId, setOpenLeadId]       = useState<number | null>(null);
  const [addColOpen, setAddColOpen]       = useState(false);
  const [newColName, setNewColName]       = useState("");

  // Queries
  const columnsQuery  = useQuery({ queryKey: ["crm-columns"], queryFn: api.getCrmColumns });
  const leadsQuery    = useQuery({ queryKey: ["crm-leads"],   queryFn: api.getCrmLeads });
  const allLeadsQuery = useQuery({ queryKey: ["leads-all"],   queryFn: () => api.getLeads() });

  // Mutations
  const createColumn = useMutation({
    mutationFn: api.createCrmColumn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-columns"] }),
  });

  const updateColumn = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; color: string; wip_limit: number | null } }) =>
      api.updateCrmColumn(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-columns"] }),
  });

  const deleteColumn = useMutation({
    mutationFn: api.deleteCrmColumn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-columns"] }),
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const moveLead = useMutation({
    mutationFn: api.moveCrmLead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-leads"] }),
  });

  const createLeadInCrm = useMutation({
    mutationFn: (p: { column_id: number; lead_id: number }) =>
      api.createCrmLead({ lead_id: p.lead_id, column_id: p.column_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      setAddLeadCol(null);
    },
  });

  const deleteCrmLead = useMutation({
    mutationFn: api.deleteCrmLead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crm-leads"] }),
  });

  // Init default columns
  useEffect(() => {
    if (columnsQuery.isSuccess && columnsQuery.data.length === 0 && !initializedRef.current) {
      initializedRef.current = true;
      DEFAULT_COLUMNS.forEach((name, i) =>
        createColumn.mutate({ name, position: i, color: DEFAULT_COLORS[i] }),
      );
    }
  }, [columnsQuery.isSuccess, columnsQuery.data]);

  // Derived data
  const columns = useMemo(
    () => [...((columnsQuery.data ?? []) as CrmColumn[])].sort((a, b) => a.position - b.position),
    [columnsQuery.data],
  );

  const crmLeads = (leadsQuery.data ?? []) as CrmLead[];

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return crmLeads;
    const q = search.toLowerCase();
    return crmLeads.filter(
      (l) => l.company.toLowerCase().includes(q) || l.phone.includes(q),
    );
  }, [crmLeads, search]);

  const leadsByColumn = useMemo(() => {
    const map: Record<number, CrmLead[]> = {};
    columns.forEach((c) => { map[c.id] = []; });
    filteredLeads.forEach((l) => {
      if (!map[l.column_id]) map[l.column_id] = [];
      map[l.column_id].push(l);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.position - b.position));
    return map;
  }, [columns, filteredLeads]);

  const openLead     = crmLeads.find((l) => l.id === openLeadId) ?? null;
  const inCrmIds     = new Set(crmLeads.map((l) => l.lead_id));
  const avail        = (allLeadsQuery.data ?? []).filter((l) => !inCrmIds.has(l.id));
  const totalLeads   = crmLeads.length;
  const totalValue   = crmLeads.reduce((s, l) => s + (l.deal_value ?? 0), 0);

  // Handlers
  const handleDrop = (columnId: number) => {
    if (draggingId == null) return;
    const arr    = leadsByColumn[columnId] ?? [];
    const newPos = arr.length ? arr[arr.length - 1].position + 1 : 0;
    moveLead.mutate({ id: draggingId, column_id: columnId, position: newPos });
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleMoveLead = (crmLeadId: number, newColId: number) => {
    const arr    = leadsByColumn[newColId] ?? [];
    const newPos = arr.length ? arr[arr.length - 1].position + 1 : 0;
    moveLead.mutate({ id: crmLeadId, column_id: newColId, position: newPos });
  };

  const addColumn = () => {
    if (!newColName.trim()) return;
    createColumn.mutate({ name: newColName.trim(), position: columns.length });
    setNewColName("");
    setAddColOpen(false);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden p-6 gap-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">CRM Kanban</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalLeads > 0
              ? `${totalLeads} negócio${totalLeads !== 1 ? "s" : ""} no pipeline${totalValue > 0 ? ` · ${formatCurrency(totalValue)} em valor total` : ""}`
              : "Pipeline de vendas — arraste os cards entre as etapas"}
          </p>
        </div>
        <div className="relative shrink-0">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-xs bg-secondary border-border/50 w-48"
            placeholder="Buscar lead..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Pipeline stats bar */}
      {columns.length > 0 && totalLeads > 0 && (
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-1">
          {columns.map((col) => {
            const count = (leadsByColumn[col.id] ?? []).length;
            const value = (leadsByColumn[col.id] ?? []).reduce((s, l) => s + (l.deal_value ?? 0), 0);
            const pct   = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <div
                key={col.id}
                className="flex-1 min-w-[110px] rounded-lg border border-border/30 bg-card/50 px-3 py-2"
                style={{ borderTopColor: col.color ?? "#6366f1", borderTopWidth: 3 }}
              >
                <p className="text-[10px] font-medium text-muted-foreground truncate">{col.name}</p>
                <p className="text-xl font-bold text-foreground leading-tight">{count}</p>
                {value > 0 && (
                  <p className="text-[10px] text-emerald-400 font-medium truncate">{formatCurrency(value)}</p>
                )}
                <div className="mt-1.5 h-1 rounded-full bg-muted/40">
                  <div
                    className="h-1 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: col.color ?? "#6366f1" }}
                  />
                </div>
              </div>
            );
          })}
          {totalValue > 0 && (
            <div
              className="flex-1 min-w-[110px] rounded-lg border border-border/30 bg-card/50 px-3 py-2"
              style={{ borderTopColor: "#22c55e", borderTopWidth: 3 }}
            >
              <p className="text-[10px] font-medium text-muted-foreground">Total pipeline</p>
              <p className="text-xl font-bold text-emerald-400 leading-tight">{formatCurrency(totalValue)}</p>
              <p className="text-[10px] text-muted-foreground/60">{totalLeads} negócios</p>
              <div className="mt-1.5 h-1 rounded-full bg-emerald-500/20" />
            </div>
          )}
        </div>
      )}

      {/* Kanban board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 items-start">

        {columns.map((column) => {
          const colLeads = leadsByColumn[column.id] ?? [];
          const isOver   = dragOverCol === column.id;
          const overWip  = column.wip_limit != null && colLeads.length >= column.wip_limit;
          const accent   = column.color ?? "#6366f1";

          return (
            <div
              key={column.id}
              className={`min-w-[260px] w-[272px] xl:w-[288px] shrink-0 flex flex-col rounded-xl border transition-all overflow-hidden ${
                isOver ? "border-primary/60 shadow-lg" : "border-border/50 bg-card"
              }`}
              style={isOver ? { borderColor: accent + "aa", boxShadow: `0 0 0 2px ${accent}33` } : {}}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol(column.id); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
              }}
              onDrop={() => handleDrop(column.id)}
            >
              {/* Column header */}
              <div
                className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 bg-card"
                style={{ borderTopColor: accent, borderTopWidth: 3 }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm text-foreground truncate">{column.name}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 shrink-0 ${
                      overWip ? "bg-red-500/20 text-red-400 border border-red-500/30" : ""
                    }`}
                  >
                    {colLeads.length}
                    {column.wip_limit != null && `/${column.wip_limit}`}
                  </Badge>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
                    onClick={() => setAddLeadCol(column)}
                    title="Adicionar lead"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
                    onClick={() => setEditingColumn(column)}
                    title="Configurar coluna"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* WIP warning banner */}
              {overWip && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20">
                  <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />
                  <span className="text-[10px] text-red-400">
                    Limite de {column.wip_limit} leads atingido
                  </span>
                </div>
              )}

              {/* Cards area */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-420px)]">
                {colLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    colColor={column.color}
                    onClick={() => setOpenLeadId(lead.id)}
                    onDragStart={() => setDraggingId(lead.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null); }}
                    onDelete={() => deleteCrmLead.mutate(lead.id)}
                  />
                ))}
                {colLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <div
                      className="h-8 w-8 rounded-full opacity-15"
                      style={{ backgroundColor: accent }}
                    />
                    <p className="text-xs text-muted-foreground/40">Nenhum lead nesta etapa</p>
                  </div>
                )}
              </div>

              {/* Quick-add footer */}
              <div className="px-2 pb-2 border-t border-border/20 pt-1.5">
                <button
                  className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-muted-foreground/40 hover:text-muted-foreground hover:bg-secondary transition-colors"
                  onClick={() => setAddLeadCol(column)}
                >
                  <Plus className="h-3 w-3" />
                  Adicionar lead
                </button>
              </div>
            </div>
          );
        })}

        {/* Add column */}
        <div className="shrink-0">
          {addColOpen ? (
            <div className="w-52 rounded-xl border border-dashed border-border/60 bg-card/50 p-3 space-y-2">
              <Input
                autoFocus
                className="h-7 text-xs bg-secondary border-border/50"
                placeholder="Nome da coluna..."
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  addColumn();
                  if (e.key === "Escape") { setAddColOpen(false); setNewColName(""); }
                }}
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-xs flex-1" onClick={addColumn}>
                  Adicionar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() => { setAddColOpen(false); setNewColName(""); }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="h-10 px-4 rounded-xl border border-dashed border-border/40 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1.5 whitespace-nowrap"
              onClick={() => setAddColOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nova coluna
            </button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <LeadDetailDialog
        lead={openLead}
        columns={columns}
        open={openLeadId != null}
        onClose={() => setOpenLeadId(null)}
        onMoveColumn={handleMoveLead}
      />

      <ColumnSettingsDialog
        column={editingColumn}
        open={editingColumn != null}
        onClose={() => setEditingColumn(null)}
        onSave={(id, data) => updateColumn.mutate({ id, data })}
        onDelete={(id) => deleteColumn.mutate(id)}
        leadCount={(leadsByColumn[editingColumn?.id ?? -1] ?? []).length}
      />

      <AddLeadDialog
        column={addLeadCol}
        open={addLeadCol != null}
        onClose={() => setAddLeadCol(null)}
        availableLeads={avail}
        onAdd={(leadId) =>
          addLeadCol && createLeadInCrm.mutate({ column_id: addLeadCol.id, lead_id: leadId })
        }
        isPending={createLeadInCrm.isPending}
      />
    </div>
  );
}
