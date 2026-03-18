import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Zap, ChevronLeft, ChevronRight, Clock, CheckCircle2, Loader2, Calendar, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

type Availability = {
  enabled: boolean;
  title: string;
  description: string;
  days: number[];
  start: string;
  end: string;
  slot_min: number;
  advance_days: number;
  min_advance_h: number;
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function pad(n: number) { return String(n).padStart(2, "0"); }

export default function BookingPage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [searchParams] = useSearchParams();
  const prefilledPhone = searchParams.get("phone") ?? "";

  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Slots state
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(prefilledPhone);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Load availability
  useEffect(() => {
    if (!tenantId) return;
    fetch(`${API_BASE}/public/slots/${tenantId}`)
      .then(r => r.json())
      .then((data: any) => {
        if (!data.availability?.enabled) { setNotFound(true); }
        else { setAvailability(data.availability); }
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [tenantId]);

  // Load slots when date selected
  useEffect(() => {
    if (!selectedDate || !tenantId) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    fetch(`${API_BASE}/public/slots/${tenantId}?date=${selectedDate}`)
      .then(r => r.json())
      .then((data: any) => { setSlots(data.slots ?? []); setSlotsLoading(false); })
      .catch(() => { setSlots([]); setSlotsLoading(false); });
  }, [selectedDate, tenantId]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null);
  }

  function isDayAvailable(day: number) {
    if (!availability) return false;
    const date = new Date(calYear, calMonth, day);
    if (date < new Date(today.getFullYear(), today.getMonth(), today.getDate())) return false;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + (availability.advance_days ?? 30));
    if (date > maxDate) return false;
    return availability.days.includes(date.getDay());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/public/book/${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, time: selectedSlot, name, phone }),
      });
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || "Erro ao agendar");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Calendar grid
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" }}>
          <Zap className="h-7 w-7 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-bold text-foreground">Agenda não disponível</h1>
        <p className="text-sm text-muted-foreground max-w-xs">Este link de agendamento não está ativo no momento.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-5 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 border border-green-500/30">
          <CheckCircle2 className="h-8 w-8 text-green-400" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Agendamento confirmado!</h1>
          <p className="text-sm text-muted-foreground">
            {selectedDate && selectedSlot && (
              <>
                📅 {new Date(`${selectedDate}T${selectedSlot}`).toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" })}
              </>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {prefilledPhone ? "Uma confirmação foi enviada no seu WhatsApp." : "Guarde a data e horário!"}
          </p>
        </div>
        <div
          className="mt-2 flex items-center gap-2 text-xs text-muted-foreground rounded-full px-4 py-2"
          style={{ background: "hsl(222 47% 10%)", border: "1px solid hsl(222 30% 16%)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
          Powered by LeadFlowAI
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 px-6 py-4 flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" }}
        >
          <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">LeadFlowAI</p>
          <p className="text-sm font-semibold text-foreground leading-tight">{availability?.title}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {availability?.description && (
          <p className="text-sm text-muted-foreground">{availability.description}</p>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr,auto]">
          {/* Calendar */}
          <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-sm font-semibold text-foreground capitalize">
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>

            <div className="grid grid-cols-7 text-center">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                const available = isDayAvailable(day);
                const dateStr = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
                const isSelected = selectedDate === dateStr;
                return (
                  <button
                    key={day}
                    disabled={!available}
                    onClick={() => available && setSelectedDate(dateStr)}
                    className={`rounded-lg p-2 text-xs font-medium transition-colors
                      ${isSelected
                        ? "text-white"
                        : available
                          ? "hover:bg-secondary text-foreground"
                          : "text-muted-foreground/30 cursor-not-allowed"
                      }`}
                    style={isSelected ? { background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" } : undefined}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Slots + Form */}
          <div className="space-y-4 lg:w-56">
            {!selectedDate ? (
              <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
                <Calendar className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Selecione uma data disponível</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Horários disponíveis
                </p>
                {slotsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 text-center">Sem horários disponíveis neste dia.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                    {slots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-lg py-2 text-xs font-medium transition-colors border
                          ${selectedSlot === slot
                            ? "text-white border-transparent"
                            : "border-border/50 text-foreground hover:bg-secondary"
                          }`}
                        style={selectedSlot === slot ? { background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))" } : undefined}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        {selectedDate && selectedSlot && (
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
              <span className="text-foreground font-medium">
                {new Date(`${selectedDate}T${selectedSlot}`).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" /> Seu nome</Label>
                <Input className="mt-1 bg-secondary border-border/50" value={name}
                  onChange={e => setName(e.target.value)} placeholder="Nome completo" required />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> WhatsApp</Label>
                <Input className="mt-1 bg-secondary border-border/50" value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="5511999999999" required />
              </div>

              {error && (
                <p className="text-xs text-destructive rounded-lg px-3 py-2" style={{ background: "hsl(0 72% 51% / 0.1)", border: "1px solid hsl(0 72% 51% / 0.25)" }}>
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full h-11 font-semibold" disabled={submitting}
                style={{ background: "linear-gradient(135deg, hsl(192 91% 52%), hsl(265 80% 60%))", border: "none", color: "hsl(222 47% 6%)" }}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Confirmar agendamento
              </Button>
            </form>
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground/50 pb-4">
          Powered by LeadFlowAI · {availability?.slot_min} min por sessão
        </p>
      </div>
    </div>
  );
}
