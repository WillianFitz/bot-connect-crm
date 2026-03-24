import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlanLock } from "@/components/PlanLock";
import {
  CalendarCheck, Plus, ChevronLeft, ChevronRight, Clock, Phone,
  Building2, Pencil, Trash2, CheckCircle2, XCircle, AlertCircle,
  Loader2, Calendar, List, Megaphone, Bell, Video, PhoneCall,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

type Apt = {
  id: number;
  lead_id: number | null;
  title: string;
  description: string | null;
  scheduled_at: string;
  type: string;
  status: string;
  reminder_minutes: number;
  reminder_sent: number;
  lead_name: string | null;
  lead_phone: string | null;
  created_at: string;
};

type FormData = {
  title: string;
  lead_id: string;
  description: string;
  date: string;
  time: string;
  type: string;
  status: string;
  reminder_minutes: string;
};

// ── Config ─────────────────────────────────────────────────────────────────────

const TYPES: Record<string, { label: string; color: string; icon: typeof CalendarCheck }> = {
  meeting:   { label: "Reunião",      color: "bg-blue-500/15 text-blue-400 border-blue-500/20",   icon: Video },
  follow_up: { label: "Follow-up",    color: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: PhoneCall },
  call:      { label: "Ligação",      color: "bg-green-500/15 text-green-400 border-green-500/20", icon: Phone },
  reminder:  { label: "Lembrete",     color: "bg-purple-500/15 text-purple-400 border-purple-500/20", icon: Bell },
};

const STATUSES: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:   { label: "Pendente",   color: "bg-secondary text-muted-foreground",                  icon: Clock },
  confirmed: { label: "Confirmado", color: "bg-blue-500/15 text-blue-400 border-blue-500/20",    icon: CheckCircle2 },
  done:      { label: "Concluído",  color: "bg-green-500/15 text-green-400 border-green-500/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelado",  color: "bg-red-500/15 text-red-400 border-red-500/20",       icon: XCircle },
  no_show:   { label: "Não compareceu", color: "bg-orange-500/15 text-orange-400 border-orange-500/20", icon: AlertCircle },
};

const REMINDERS = [
  { value: "0", label: "Sem lembrete" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "120", label: "2 horas antes" },
  { value: "1440", label: "1 dia antes" },
];

const EMPTY_FORM: FormData = {
  title: "", lead_id: "", description: "", date: "", time: "09:00",
  type: "meeting", status: "pending", reminder_minutes: "30",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtMonth(y: number, m: number) {
  return new Date(y, m).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function isoMonth(y: number, m: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
function aptToLocalDate(iso: string) {
  // Parse as local datetime (stored without timezone)
  return new Date(iso.replace(" ", "T"));
}

// ── Calendar ───────────────────────────────────────────────────────────────────

function CalendarView({ apts, onSelect, onNew }: {
  apts: Apt[];
  onSelect: (apt: Apt) => void;
  onNew: (date: string) => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const aptsByDay = useMemo(() => {
    const map: Record<number, Apt[]> = {};
    for (const a of apts) {
      const d = aptToLocalDate(a.scheduled_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(a);
      }
    }
    return map;
  }, [apts, year, month]);

  const dayApts = selectedDay ? (aptsByDay[selectedDay] ?? []) : [];

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
      {/* Calendar grid */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-semibold capitalize text-foreground">{fmtMonth(year, month)}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <div className="grid grid-cols-7 text-center mb-1">
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => (
            <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const isSelected = day === selectedDay;
            const dayAptList = aptsByDay[day] ?? [];
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`relative flex flex-col items-center justify-start rounded-lg p-1 min-h-[52px] text-xs transition-colors
                  ${isSelected ? "bg-primary text-primary-foreground" : isToday ? "bg-primary/20 text-primary" : "hover:bg-secondary text-foreground"}`}
              >
                <span className="font-medium leading-none mb-1">{day}</span>
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {dayAptList.slice(0, 3).map((a) => {
                    const cfg = TYPES[a.type] ?? TYPES.meeting;
                    const dotColor = a.type === "meeting" ? "bg-blue-400" : a.type === "follow_up" ? "bg-amber-400" : a.type === "call" ? "bg-green-400" : "bg-purple-400";
                    return <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white/80" : dotColor}`} />;
                  })}
                  {dayAptList.length > 3 && <span className={`text-[9px] leading-none ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>+{dayAptList.length - 3}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day panel */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {selectedDay
              ? new Date(year, month, selectedDay).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
              : "Selecione um dia"}
          </h3>
          {selectedDay && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => {
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`;
                onNew(dateStr);
              }}
            >
              <Plus className="h-3 w-3" /> Novo
            </Button>
          )}
        </div>

        {!selectedDay && (
          <p className="text-xs text-muted-foreground">Clique em um dia no calendário para ver os agendamentos.</p>
        )}

        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {dayApts.length === 0 && selectedDay && (
            <p className="text-xs text-muted-foreground">Nenhum agendamento neste dia.</p>
          )}
          {dayApts.map(apt => <AptCard key={apt.id} apt={apt} onEdit={onSelect} compact />)}
        </div>
      </div>
    </div>
  );
}

// ── AptCard ────────────────────────────────────────────────────────────────────

function AptCard({ apt, onEdit, compact = false }: { apt: Apt; onEdit: (a: Apt) => void; compact?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const typeCfg = TYPES[apt.type] ?? TYPES.meeting;
  const statusCfg = STATUSES[apt.status] ?? STATUSES.pending;
  const TypeIcon = typeCfg.icon;

  const deleteMut = useMutation({
    mutationFn: () => api.deleteAppointment(apt.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Agendamento excluído" });
    },
  });

  const markDone = useMutation({
    mutationFn: () => api.updateAppointment(apt.id, { status: "done" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  });

  return (
    <div className={`rounded-lg border border-border/40 bg-secondary/40 p-3 space-y-2 hover:border-border/70 transition-colors ${compact ? "text-xs" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${typeCfg.color}`}>
            <TypeIcon className="h-3 w-3" />
          </div>
          <span className="font-medium text-foreground truncate">{apt.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${statusCfg.color}`}>
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3 text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDate(apt.scheduled_at)} {fmtTime(apt.scheduled_at)}</span>
        {apt.lead_name && <span className="flex items-center gap-1 truncate"><Building2 className="h-3 w-3" />{apt.lead_name}</span>}
      </div>

      {apt.description && !compact && (
        <p className="text-xs text-muted-foreground line-clamp-2">{apt.description}</p>
      )}

      {apt.lead_phone && !compact && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" />{apt.lead_phone}
        </div>
      )}

      <div className="flex items-center gap-1 pt-1 border-t border-border/30">
        {apt.status !== "done" && apt.status !== "cancelled" && (
          <Button variant="ghost" size="sm" className="h-6 text-xs text-green-400 hover:text-green-300 px-2 gap-1"
            onClick={() => markDone.mutate()}>
            <CheckCircle2 className="h-3 w-3" /> Concluído
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2 gap-1" onClick={() => onEdit(apt)}>
          <Pencil className="h-3 w-3" /> Editar
        </Button>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive px-2 gap-1"
          onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
          <Trash2 className="h-3 w-3" /> Excluir
        </Button>
      </div>
    </div>
  );
}

// ── AppointmentModal ───────────────────────────────────────────────────────────

function AppointmentModal({ open, onClose, editing, defaultDate }: {
  open: boolean;
  onClose: () => void;
  editing: Apt | null;
  defaultDate?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const leadsQuery = useQuery({ queryKey: ["leads-simple"], queryFn: () => api.getLeads() });

  const initForm = (): FormData => {
    if (editing) {
      const d = aptToLocalDate(editing.scheduled_at);
      return {
        title: editing.title,
        lead_id: editing.lead_id ? String(editing.lead_id) : "",
        description: editing.description ?? "",
        date: d.toISOString().slice(0, 10),
        time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        type: editing.type,
        status: editing.status,
        reminder_minutes: String(editing.reminder_minutes),
      };
    }
    return { ...EMPTY_FORM, date: defaultDate ?? "" };
  };

  const [form, setForm] = useState<FormData>(initForm);

  // Reset form when modal opens
  useState(() => { setForm(initForm()); });

  const set = (k: keyof FormData, v: string) => setForm(f => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => {
      const scheduled_at = `${form.date}T${form.time}:00`;
      const payload = {
        title: form.title,
        lead_id: form.lead_id ? parseInt(form.lead_id) : null,
        description: form.description || undefined,
        scheduled_at,
        type: form.type,
        status: form.status,
        reminder_minutes: parseInt(form.reminder_minutes),
      };
      return editing ? api.updateAppointment(editing.id, payload) : api.createAppointment(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: editing ? "Agendamento atualizado" : "Agendamento criado" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg bg-card border-border/50">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Agendamento" : "Novo Agendamento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="text-xs text-muted-foreground">Título *</Label>
            <Input className="mt-1 bg-secondary border-border/50" value={form.title}
              onChange={e => set("title", e.target.value)} placeholder="Ex: Reunião de apresentação" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Data *</Label>
              <Input type="date" className="mt-1 bg-secondary border-border/50" value={form.date}
                onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Horário *</Label>
              <Input type="time" className="mt-1 bg-secondary border-border/50" value={form.time}
                onChange={e => set("time", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <Select value={form.type} onValueChange={v => set("type", v)}>
                <SelectTrigger className="mt-1 bg-secondary border-border/50 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger className="mt-1 bg-secondary border-border/50 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUSES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Lead vinculado</Label>
            <Select value={form.lead_id || "none"} onValueChange={v => set("lead_id", v === "none" ? "" : v)}>
              <SelectTrigger className="mt-1 bg-secondary border-border/50 h-9 text-sm">
                <SelectValue placeholder="Nenhum lead vinculado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum lead</SelectItem>
                {(leadsQuery.data ?? []).map(l => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.company} — {l.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Lembrete via WhatsApp</Label>
            <Select value={form.reminder_minutes} onValueChange={v => set("reminder_minutes", v)}>
              <SelectTrigger className="mt-1 bg-secondary border-border/50 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMINDERS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Descrição / observações</Label>
            <Textarea className="mt-1 bg-secondary border-border/50 text-sm resize-none" rows={3}
              value={form.description} onChange={e => set("description", e.target.value)}
              placeholder="Detalhes do agendamento..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="border-border/50" onClick={onClose}>Cancelar</Button>
          <Button disabled={saveMut.isPending || !form.title || !form.date} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editing ? "Salvar" : "Criar agendamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Scheduled Campaigns Tab ────────────────────────────────────────────────────

function ScheduledCampaigns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const campsQuery = useQuery({ queryKey: ["campaigns"], queryFn: api.getCampaigns });

  const scheduledCamps = (campsQuery.data ?? []).filter((c: any) => c.scheduled_at && !c.scheduled_dispatched);

  const unschedule = useMutation({
    mutationFn: (id: number) => api.updateCampaign(id, { scheduled_at: null, scheduled_dispatched: 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Agendamento cancelado" });
    },
  });

  const [editingCamp, setEditingCamp] = useState<any | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");

  const saveSchedule = useMutation({
    mutationFn: () => api.updateCampaign(editingCamp.id, { scheduled_at: scheduleAt, scheduled_dispatched: 0, status: "active" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({ title: "Campanha agendada!" });
      setEditingCamp(null);
    },
  });

  const allCamps = (campsQuery.data ?? []).filter((c: any) => !c.scheduled_dispatched);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Campanhas com Disparo Agendado
        </h3>
        <p className="text-xs text-muted-foreground">
          Defina uma data/hora para o disparo automático de qualquer campanha. O sistema executará na hora certa sem precisar de ação manual.
        </p>

        {campsQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-2">
            {scheduledCamps.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">Nenhuma campanha agendada no momento.</p>
            )}
            {scheduledCamps.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(c.scheduled_at).toLocaleString("pt-BR")}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive"
                  onClick={() => unschedule.mutate(c.id)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Agendar campanha</h3>
        <div className="flex flex-wrap gap-2">
          {allCamps.map((c: any) => (
            <Button key={c.id} variant="outline" size="sm" className="text-xs border-border/50 gap-1"
              onClick={() => { setEditingCamp(c); setScheduleAt(""); }}>
              <Megaphone className="h-3 w-3" /> {c.name}
            </Button>
          ))}
          {allCamps.length === 0 && (
            <p className="text-xs text-muted-foreground">Crie campanhas primeiro na aba Campanhas.</p>
          )}
        </div>
      </div>

      <Dialog open={!!editingCamp} onOpenChange={v => { if (!v) setEditingCamp(null); }}>
        <DialogContent className="max-w-sm bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Agendar: {editingCamp?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs text-muted-foreground">Data e hora do disparo</Label>
              <Input type="datetime-local" className="mt-1 bg-secondary border-border/50"
                value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border/50" onClick={() => setEditingCamp(null)}>Cancelar</Button>
            <Button disabled={!scheduleAt || saveSchedule.isPending} onClick={() => saveSchedule.mutate()}>
              {saveSchedule.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
              Agendar disparo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Stats bar ──────────────────────────────────────────────────────────────────

function StatsBar({ apts }: { apts: Apt[] }) {
  const counts = useMemo(() => {
    const r = { total: apts.length, pending: 0, confirmed: 0, done: 0, today: 0 };
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const a of apts) {
      if (a.status === "pending") r.pending++;
      if (a.status === "confirmed") r.confirmed++;
      if (a.status === "done") r.done++;
      if (a.scheduled_at.slice(0, 10) === todayStr) r.today++;
    }
    return r;
  }, [apts]);

  const items = [
    { label: "Total", value: counts.total, color: "text-foreground" },
    { label: "Hoje", value: counts.today, color: "text-amber-400" },
    { label: "Pendentes", value: counts.pending, color: "text-muted-foreground" },
    { label: "Confirmados", value: counts.confirmed, color: "text-blue-400" },
    { label: "Concluídos", value: counts.done, color: "text-green-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map(i => (
        <div key={i.label} className="rounded-xl border border-border/50 bg-card px-4 py-3 text-center">
          <p className={`text-2xl font-bold ${i.color}`}>{i.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{i.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Appointments() {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(isoMonth(today.getFullYear(), today.getMonth()));

  const { data: planData } = useQuery({ queryKey: ["tenant-plan"], queryFn: () => api.getTenantPlan(), staleTime: 5 * 60_000 });
  const hasPro = (planData?.plan ?? "starter") === "pro";
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApt, setEditingApt] = useState<Apt | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState("all");

  const aptsQuery = useQuery({
    queryKey: ["appointments", currentMonth],
    queryFn: () => api.getAppointments(currentMonth),
  });

  const apts = aptsQuery.data ?? [];

  const filteredApts = useMemo(() => {
    if (filterStatus === "all") return apts;
    return apts.filter(a => a.status === filterStatus);
  }, [apts, filterStatus]);

  function openNew(date?: string) {
    setEditingApt(null);
    setDefaultDate(date);
    setModalOpen(true);
  }
  function openEdit(apt: Apt) {
    setEditingApt(apt);
    setDefaultDate(undefined);
    setModalOpen(true);
  }

  // Sync calendar month query when user navigates
  function handleMonthChange(y: number, m: number) {
    setCurrentMonth(isoMonth(y, m));
  }

  return (
    <PlanLock minPlan="pro" locked={!hasPro}>
    <div className="space-y-5 animate-slide-in w-full max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">Reuniões, follow-ups, ligações e lembretes</p>
        </div>
        <Button className="gap-2" onClick={() => openNew()}>
          <Plus className="h-4 w-4" /> Novo Agendamento
        </Button>
      </div>

      <StatsBar apts={apts} />

      <Tabs defaultValue="calendar" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList className="bg-secondary border border-border/50">
            <TabsTrigger value="calendar" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
            <TabsTrigger value="list" className="gap-1.5"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Campanhas</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs bg-secondary border-border/50 w-36">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUSES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="calendar">
          {aptsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <CalendarView apts={filteredApts} onSelect={openEdit} onNew={openNew} />
          )}
        </TabsContent>

        <TabsContent value="list">
          {aptsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filteredApts.length === 0 ? (
            <div className="rounded-xl border border-border/50 bg-card p-10 text-center">
              <CalendarCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
              <Button size="sm" className="mt-4 gap-1" onClick={() => openNew()}>
                <Plus className="h-4 w-4" /> Criar primeiro agendamento
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredApts.map(a => <AptCard key={a.id} apt={a} onEdit={openEdit} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="campaigns">
          <ScheduledCampaigns />
        </TabsContent>
      </Tabs>

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editingApt}
        defaultDate={defaultDate}
      />
    </div>
    </PlanLock>
  );
}
