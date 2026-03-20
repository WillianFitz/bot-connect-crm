import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Phone, CalendarClock, Pencil, Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface FunnelOption {
  id: number;
  name: string;
  status: string;
}

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
  funnel_id: number | null;
  folder_id: number | null;
  api_source: string | null;
  template_id: number | null;
  template_variables: string | null;
}

interface WaTemplate {
  id: number;
  name: string;
  language: string;
  body_text: string;
  status: string;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Campaigns() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null);

  const [name, setName] = useState("");
  const [delayMin, setDelayMin] = useState(6);
  const [delayMax, setDelayMax] = useState(15);
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("18:00");
  const [blockedDays, setBlockedDays] = useState<string[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [apiSource, setApiSource] = useState<"evolution" | "whatsapp_official">("evolution");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [templateVariables, setTemplateVariables] = useState<string[]>([]);

  const funnelsQuery = useQuery({
    queryKey: ["funnels"],
    queryFn: api.getFunnels,
  });
  const funnelOptions = (funnelsQuery.data ?? []) as FunnelOption[];

  const foldersQuery = useQuery({
    queryKey: ["lead-folders"],
    queryFn: api.getLeadFolders,
  });
  const folderOptions = foldersQuery.data ?? [];

  const waTemplatesQuery = useQuery({
    queryKey: ["wa-official-templates"],
    queryFn: api.getWhatsappTemplates,
  });
  const waTemplates = (waTemplatesQuery.data ?? []).filter((t) => t.status === "APPROVED") as WaTemplate[];

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });
  useEffect(() => {
    if (settingsQuery.data?.notification_whatsapp_phone != null)
      setWhatsappNumber(settingsQuery.data.notification_whatsapp_phone);
  }, [settingsQuery.data?.notification_whatsapp_phone]);

  const saveSettings = useMutation({
    mutationFn: (value: string) =>
      api.updateSettings({ notification_whatsapp_phone: value }),
    onSuccess: (_, value) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setWhatsappNumber(value);
      toast({ title: "Número salvo.", description: "Você receberá notificações neste número." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const campaignsQuery = useQuery({
    queryKey: ["campaigns"],
    queryFn: api.getCampaigns,
    refetchInterval: (query) => {
      // Atualiza a cada 5s se houver campanha ativa (processando)
      const data = query.state.data as Campaign[] | undefined;
      return data?.some((c) => c.status === "active") ? 5000 : false;
    },
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
      setSelectedFunnelId(null);
      setSelectedFolderId(null);
      setApiSource("evolution");
      setSelectedTemplateId(null);
      setTemplateVariables([]);
      setShowCreateDialog(false);
      toast({ title: "Campanha criada." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao criar campanha", description: err.message, variant: "destructive" });
    },
  });

  const updateCampaign = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      api.updateCampaign(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setEditingCampaign(null);
      toast({ title: "Campanha atualizada." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar campanha", description: err.message, variant: "destructive" });
    },
  });

  const setCampaignStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateCampaign(id, { status }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast({
        title: status === "active" ? "Campanha ativada." : "Campanha pausada.",
        description: status === "active"
          ? "Os disparos serão processados no horário configurado. Use «Processar agora» para enviar um lote imediatamente."
          : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao alterar status", description: err.message, variant: "destructive" });
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: (id: number) => api.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setCampaignToDelete(null);
      toast({ title: "Campanha excluída." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const runCampaigns = useMutation({
    mutationFn: (ignoreWindow?: boolean) => api.runCampaigns({ ignoreWindow }),
    onSuccess: (data, ignoreWindow) => {
      // Recarrega após 3s para mostrar progresso inicial
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["campaigns"] }), 3000);
      if (ignoreWindow) {
        toast({
          title: "Processamento iniciado",
          description: "Os disparos estão sendo enviados em segundo plano. Os contadores atualizam automaticamente.",
        });
        return;
      }
      const total = data?.campaigns?.reduce((s, c) => s + c.sent + c.errors, 0) ?? 0;
      const hasErrors = (data?.campaigns?.some((c) => c.errors > 0) ?? false) || (data?.errorSummary?.length ?? 0) > 0;
      const errorMsg = data?.errorSummary?.length
        ? data.errorSummary[0] + (data.errorSummary.length > 1 ? ` (+${data.errorSummary.length - 1} mais)` : "")
        : null;
      toast({
        title: hasErrors ? "Processado com erros" : "Processamento executado",
        description: total > 0
          ? hasErrors && errorMsg
            ? `${data.processed} processado(s). Erro: ${errorMsg}`
            : `${data.processed} lead(s) processado(s).`
          : "Nenhum lead pendente no horário das campanhas ativas.",
        variant: hasErrors ? "destructive" : "default",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
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
      funnel_id: selectedFunnelId,
      folder_id: selectedFolderId,
      api_source: apiSource,
      template_id: apiSource === "whatsapp_official" ? selectedTemplateId : null,
      template_variables: apiSource === "whatsapp_official" ? templateVariables : [],
    });
  };

  const openEdit = (c: Campaign) => {
    setEditingCampaign(c);
    const days = typeof c.days_blocked === "string"
      ? (() => { try { return JSON.parse(c.days_blocked); } catch { return []; } })()
      : (c.days_blocked || []);
    setName(c.name);
    setDelayMin(c.delay_min ?? 6);
    setDelayMax(c.delay_max ?? 15);
    setTimeFrom(c.time_from ?? "09:00");
    setTimeTo(c.time_to ?? "18:00");
    setBlockedDays(Array.isArray(days) ? days : []);
    setSelectedFunnelId(c.funnel_id ?? null);
    setSelectedFolderId(c.folder_id ?? null);
    setApiSource((c.api_source === "whatsapp_official" ? "whatsapp_official" : "evolution") as "evolution" | "whatsapp_official");
    setSelectedTemplateId(c.template_id ?? null);
    try { setTemplateVariables(c.template_variables ? JSON.parse(c.template_variables) : []); } catch { setTemplateVariables([]); }
  };

  const handleSaveEdit = () => {
    if (!editingCampaign) return;
    if (!name) return;
    updateCampaign.mutate({
      id: editingCampaign.id,
      payload: {
        name,
        delay_min: delayMin,
        delay_max: delayMax,
        time_from: timeFrom,
        time_to: timeTo,
        days_blocked: blockedDays,
        funnel_id: selectedFunnelId,
        folder_id: selectedFolderId,
        api_source: apiSource,
        template_id: apiSource === "whatsapp_official" ? selectedTemplateId : null,
        template_variables: apiSource === "whatsapp_official" ? templateVariables : [],
      },
    });
  };

  const campaigns = (campaignsQuery.data || []) as Campaign[];

  return (
    <div className="space-y-6 animate-slide-in w-full">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Disparos</h1>
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
          <Button
            variant="outline"
            className="mt-5"
            disabled={saveSettings.isPending}
            onClick={() => saveSettings.mutate(whatsappNumber)}
          >
            {saveSettings.isPending ? "Salvando..." : "Salvar"}
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
            onClick={() => {
              setName("");
              setDelayMin(6);
              setDelayMax(15);
              setTimeFrom("09:00");
              setTimeTo("18:00");
              setBlockedDays([]);
              setSelectedFunnelId(null);
              setSelectedFolderId(null);
              setApiSource("evolution");
              setSelectedTemplateId(null);
              setTemplateVariables([]);
              setShowCreateDialog(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            Minhas campanhas
          </h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={runCampaigns.isPending}
              onClick={() => runCampaigns.mutate(true)}
              title="Envia um lote de mensagens agora (ignora horário configurado)"
            >
              {runCampaigns.isPending ? "Processando..." : "Processar agora"}
            </Button>
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
        </div>

        <div className="border border-border/30 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-secondary/50 border-b border-border/40">
              <tr>
                {[
                  "Nome",
                  "Status",
                  "Pasta",
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
                    colSpan={8}
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
                      {c.folder_id
                        ? (folderOptions.find((f) => f.id === c.folder_id)?.name ?? `#${c.folder_id}`)
                        : <span className="text-muted-foreground/40">Todos</span>}
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
                    <td className="px-3 py-2 text-xs text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {(c.status === "draft" || c.status === "paused") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                            onClick={() => setCampaignStatus.mutate({ id: c.id, status: "active" })}
                            title="Ativar campanha"
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {c.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                            onClick={() => setCampaignStatus.mutate({ id: c.id, status: "paused" })}
                            title="Pausar campanha"
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(c)}
                          title="Editar campanha"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                          onClick={() => setCampaignToDelete(c)}
                          title="Excluir campanha"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={(open) => !open && setShowCreateDialog(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Nome da campanha</Label>
              <Input
                className="mt-1 bg-secondary border-border/50"
                placeholder="Ex: Abertura Setembro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Delay mínimo (segundos)</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1 bg-secondary border-border/50"
                  value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Delay máximo (segundos)</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1 bg-secondary border-border/50"
                  value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Das (horário de Brasília)</Label>
                <Input
                  type="time"
                  className="mt-1 bg-secondary border-border/50"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Até (horário de Brasília)</Label>
                <Input
                  type="time"
                  className="mt-1 bg-secondary border-border/50"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Não disparar nos dias</Label>
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
            <div>
              <Label className="text-xs text-muted-foreground">Funil de prospecção (opcional)</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedFunnelId ?? ""}
                onChange={(e) => setSelectedFunnelId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Nenhum (usar IA) —</option>
                {funnelOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {selectedFunnelId && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Se um funil for selecionado, o bot enviará as mensagens do funil em sequência ao invés da IA.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pasta de leads (opcional)</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedFolderId ?? ""}
                onChange={(e) => setSelectedFolderId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Todos os leads —</option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {selectedFolderId && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Apenas leads desta pasta serão incluídos no disparo.
                </p>
              )}
            </div>
            {/* API Source */}
            <div>
              <Label className="text-xs text-muted-foreground">Canal de envio</Label>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setApiSource("evolution")}
                  className={`flex-1 rounded-md border text-xs py-2 px-3 transition-colors ${apiSource === "evolution" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border/50 text-muted-foreground hover:bg-secondary"}`}>
                  Evolution API
                </button>
                <button type="button" onClick={() => setApiSource("whatsapp_official")}
                  className={`flex-1 rounded-md border text-xs py-2 px-3 transition-colors ${apiSource === "whatsapp_official" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border/50 text-muted-foreground hover:bg-secondary"}`}>
                  API Oficial WhatsApp
                </button>
              </div>
            </div>
            {apiSource === "whatsapp_official" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Template aprovado</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={selectedTemplateId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setSelectedTemplateId(id);
                      setTemplateVariables([]);
                    }}
                  >
                    <option value="">— Selecione um template —</option>
                    {waTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                    ))}
                  </select>
                  {waTemplates.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">Nenhum template aprovado. Crie um em Configurações → WhatsApp Oficial.</p>
                  )}
                </div>
                {selectedTemplateId && (() => {
                  const tmpl = waTemplates.find((t) => t.id === selectedTemplateId);
                  if (!tmpl) return null;
                  const vars = Array.from(tmpl.body_text.matchAll(/\{\{(\d+)\}\}/g));
                  if (vars.length === 0) return null;
                  return (
                    <div>
                      <Label className="text-xs text-muted-foreground">Mapeamento de variáveis</Label>
                      <p className="text-[10px] text-muted-foreground mb-1">Para cada {"{{N}}"} no template, escolha o campo do lead.</p>
                      {vars.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground w-10">{`{{${m[1]}}}`}</span>
                          <select
                            className="flex-1 rounded-md border border-border/50 bg-secondary text-xs px-2 py-1.5 focus:outline-none"
                            value={templateVariables[i] ?? ""}
                            onChange={(e) => {
                              const newVars = [...templateVariables];
                              newVars[i] = e.target.value;
                              setTemplateVariables(newVars);
                            }}
                          >
                            <option value="">— Escolha —</option>
                            <option value="{{company}}">Nome da empresa</option>
                            <option value="{{phone}}">Telefone</option>
                            <option value="{{link_agendamento}}">Link de agendamento</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!name || createCampaign.isPending}
              onClick={handleCreate}
            >
              {createCampaign.isPending ? "Criando..." : "Criar campanha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCampaign} onOpenChange={(open) => !open && setEditingCampaign(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar campanha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Nome da campanha</Label>
              <Input
                className="mt-1 bg-secondary border-border/50"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Delay mínimo (segundos)</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1 bg-secondary border-border/50"
                  value={delayMin}
                  onChange={(e) => setDelayMin(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Delay máximo (segundos)</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1 bg-secondary border-border/50"
                  value={delayMax}
                  onChange={(e) => setDelayMax(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Das (horário de Brasília)</Label>
                <Input
                  type="time"
                  className="mt-1 bg-secondary border-border/50"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Até (horário de Brasília)</Label>
                <Input
                  type="time"
                  className="mt-1 bg-secondary border-border/50"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Não disparar nos dias</Label>
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
            <div>
              <Label className="text-xs text-muted-foreground">Funil de prospecção (opcional)</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedFunnelId ?? ""}
                onChange={(e) => setSelectedFunnelId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Nenhum (usar IA) —</option>
                {funnelOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {selectedFunnelId && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Se um funil for selecionado, o bot enviará as mensagens do funil em sequência ao invés da IA.
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pasta de leads (opcional)</Label>
              <select
                className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                value={selectedFolderId ?? ""}
                onChange={(e) => setSelectedFolderId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">— Todos os leads —</option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              {selectedFolderId && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Apenas leads desta pasta serão incluídos no disparo.
                </p>
              )}
            </div>
            {/* API Source */}
            <div>
              <Label className="text-xs text-muted-foreground">Canal de envio</Label>
              <div className="flex gap-2 mt-1">
                <button type="button" onClick={() => setApiSource("evolution")}
                  className={`flex-1 rounded-md border text-xs py-2 px-3 transition-colors ${apiSource === "evolution" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border/50 text-muted-foreground hover:bg-secondary"}`}>
                  Evolution API
                </button>
                <button type="button" onClick={() => setApiSource("whatsapp_official")}
                  className={`flex-1 rounded-md border text-xs py-2 px-3 transition-colors ${apiSource === "whatsapp_official" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border/50 text-muted-foreground hover:bg-secondary"}`}>
                  API Oficial WhatsApp
                </button>
              </div>
            </div>
            {apiSource === "whatsapp_official" && (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Template aprovado</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-border/50 bg-secondary text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={selectedTemplateId ?? ""}
                    onChange={(e) => {
                      const id = e.target.value ? Number(e.target.value) : null;
                      setSelectedTemplateId(id);
                      setTemplateVariables([]);
                    }}
                  >
                    <option value="">— Selecione um template —</option>
                    {waTemplates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                    ))}
                  </select>
                  {waTemplates.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1">Nenhum template aprovado. Crie um em Configurações → WhatsApp Oficial.</p>
                  )}
                </div>
                {selectedTemplateId && (() => {
                  const tmpl = waTemplates.find((t) => t.id === selectedTemplateId);
                  if (!tmpl) return null;
                  const vars = Array.from(tmpl.body_text.matchAll(/\{\{(\d+)\}\}/g));
                  if (vars.length === 0) return null;
                  return (
                    <div>
                      <Label className="text-xs text-muted-foreground">Mapeamento de variáveis</Label>
                      <p className="text-[10px] text-muted-foreground mb-1">Para cada {"{{N}}"} no template, escolha o campo do lead.</p>
                      {vars.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground w-10">{`{{${m[1]}}}`}</span>
                          <select
                            className="flex-1 rounded-md border border-border/50 bg-secondary text-xs px-2 py-1.5 focus:outline-none"
                            value={templateVariables[i] ?? ""}
                            onChange={(e) => {
                              const newVars = [...templateVariables];
                              newVars[i] = e.target.value;
                              setTemplateVariables(newVars);
                            }}
                          >
                            <option value="">— Escolha —</option>
                            <option value="{{company}}">Nome da empresa</option>
                            <option value="{{phone}}">Telefone</option>
                            <option value="{{link_agendamento}}">Link de agendamento</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCampaign(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!name || updateCampaign.isPending}
              onClick={handleSaveEdit}
            >
              {updateCampaign.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a campanha &quot;{campaignToDelete?.name}&quot;? Os registros de envio desta campanha também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCampaign.isPending}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => campaignToDelete && deleteCampaign.mutate(campaignToDelete.id)}
              disabled={deleteCampaign.isPending}
            >
              {deleteCampaign.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
