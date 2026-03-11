import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Phone, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface Campaign {
  id: number;
  name: string;
  delay_min: number;
  delay_max: number;
  time_from: string;
  time_to: string;
  days_blocked: string; // JSON
  status: string;
  total_leads: number;
  sent: number;
  errors: number;
  no_whatsapp: number;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Campaigns() {
  const queryClient = useQueryClient();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [delayMin, setDelayMin] = useState(6);
  const [delayMax, setDelayMax] = useState(15);
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("18:00");
  const [blockedDays, setBlockedDays] = useState<string[]>([]);

  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.getCampaigns,
  });

  const createCampaign = useMutation({
    mutationFn: api.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setName("");
      setDelayMin(6);
      setDelayMax(15);
      setTimeFrom("09:00");
      setTimeTo("18:00");
      setBlockedDays([]);
      setShowForm(false);
    },
  });

  const toggleDay = (day: string) => {
    setBlockedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleCreate = () => {
    if (!name) return;
    createCampaign.mutate({
      name,
      delay_min: delayMin,
      delay_max: delayMax,
      time_from: timeFrom,
      time_to: timeTo,
      days_blocked: blockedDays,
    });
  };

  const campaigns = (campaignsQuery.data || []) as Campaign[];

  return (
    <div className="space-y-6 animate-slide-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Disparos</h1>
        <p className="text-sm text-muted-foreground">
          Configure campanhas de disparo em massa com regras de horário e
          intervalo.
        </p>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" />
          WhatsApp para Notificações
        </h2>
        <p className="text-xs text-muted-foreground">
          Receba atualizações sobre suas campanhas.
        </p>
        <div className="flex items-end gap-3 max-w-md">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">
              Número do WhatsApp
            </Label>
            <Input
              className="mt-1 bg-secondary border-border/50"
              placeholder="(00) 00000-0000"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
          </div>
          <Button variant="outline" className="mt-5">
            Salvar
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Disparos
            </h2>
          </div>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        </div>

        {showForm && (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Nome da campanha
                </Label>
                <Input
                  className="mt-1 bg-secondary border-border/50"
                  placeholder="Ex: Abertura Setembro"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Delay mínimo (minutos)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    className="mt-1 bg-secondary border-border/50"
                    value={delayMin}
                    onChange={(e) => setDelayMin(Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">
                    Delay máximo (minutos)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    className="mt-1 bg-secondary border-border/50"
                    value={delayMax}
                    onChange={(e) => setDelayMax(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Disparar entre às
                  <span className="text-[10px] text-muted-foreground">
                    (pode variar até 3 min para iniciar)
                  </span>
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="time"
                    className="bg-secondary border-border/50"
                    value={timeFrom}
                    onChange={(e) => setTimeFrom(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Formato HH:MM
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  Com término às
                  <span className="text-[10px] text-muted-foreground">
                    (pode variar até 3 min para finalizar)
                  </span>
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="time"
                    className="bg-secondary border-border/50"
                    value={timeTo}
                    onChange={(e) => setTimeTo(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    Formato HH:MM
                  </span>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">
                  Não disparar nos dias da semana
                </Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {weekDays.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`px-2 py-1 rounded-full text-[11px] border ${
                        blockedDays.includes(day)
                          ? "bg-secondary text-foreground border-border/70"
                          : "bg-background text-muted-foreground border-border/40"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!name || createCampaign.isPending}
                  onClick={handleCreate}
                >
                  {createCampaign.isPending ? "Criando..." : "Criar campanha"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Minhas campanhas
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["campaigns"] })
            }
          >
            Atualizar
          </Button>
        </div>

        <div className="border border-border/30 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border/40">
              <tr>
                {[
                  "Nome",
                  "Status",
                  "Total",
                  "Enviados",
                  "Erros",
                  "Sem WhatsApp",
                  "Ações",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-6 text-center text-xs text-muted-foreground"
                  >
                    Nenhuma campanha
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-foreground">
                      {c.name}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <Badge variant="secondary" className="text-[10px]">
                        {c.status === "active"
                          ? "Ativa"
                          : c.status === "paused"
                          ? "Pausada"
                          : c.status === "completed"
                          ? "Concluída"
                          : "Rascunho"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.total_leads}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.sent}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.errors}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {c.no_whatsapp}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground text-right">
                      <CalendarClock className="h-3.5 w-3.5 inline-block text-muted-foreground" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
