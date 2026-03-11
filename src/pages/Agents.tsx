import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, MessageCircle, CalendarClock, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

type AgentId = "disparo" | "atendimento" | "agendamento";

interface AgentFormState {
  id: AgentId;
  name: string;
  type: "attendance" | "scheduling";
  base_prompt: string;
  default_message: string;
  pause_minutes: number;
  pause_definitive: boolean;
  agenda_link: string;
  human_number: string;
  human_group_id: string;
}

const DISPARO_PROMPT_DEFAULT = `🎯 Agente de Disparos:
Você é um agente de disparo automático.
Sua única tarefa é gerar *uma saudação curta, natural e humana* para iniciar uma conversa com um lead.

---

💬 Regras de mensagem:
- Escolha *apenas uma* saudação por vez.
- A saudação deve parecer espontânea, natural e diferente em cada envio.
- *Não* use “bom dia”, “boa tarde” ou “boa noite”.
- *Não adicione* nada além da saudação (sem assinatura, sem texto extra).
- Use variações simples e neutras.

Escolha *aleatoriamente* entre as opções abaixo (ou pequenas variações delas):
- "Olá, tudo bem?"
- "Olá, como vai?"
- "Oi, tudo certo?"
- "Olá, tudo bem?"
- "Oi, tudo bom?"
- "Olá 👋"
- "Oi, tudo jóia?"

---

Use a ferramenta Date & Time sempre que precisar saber qual dia é hoje.

📦 Formato obrigatório de resposta:
Responda *exclusivamente* em JSON, neste formato exato:

{
  "mensagem": "Oi, tudo certo?"
}

⚠️ Não adicione texto fora do JSON.
⚠️ Não explique o que está fazendo.
Apenas devolva o JSON conforme o exemplo acima, com a saudação escolhida.`;

const ATENDIMENTO_PROMPT_PLACEHOLDER =
  "Insira o prompt base do seu agente de atendimento.\nEx: como ele deve responder, tom de voz, regras do negócio, quando chamar humano etc.";

const AGENDAMENTO_PROMPT_PLACEHOLDER =
  "Insira o prompt base do seu agente de agendamento.\nEx: como identificar intenção de reunião, como sugerir horários, como usar o link da agenda etc.";

export default function Agents() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<AgentId>("disparo");
  const [forms, setForms] = useState<Record<AgentId, AgentFormState> | null>(
    null,
  );

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  useEffect(() => {
    if (!agentsQuery.data) return;

    const byId: Record<AgentId, AgentFormState> = {
      disparo: {
        id: "disparo",
        name: "Agente de Disparo",
        type: "attendance",
        base_prompt:
          agentsQuery.data.find((a: any) => a.id === "disparo")?.base_prompt ||
          DISPARO_PROMPT_DEFAULT,
        default_message:
          agentsQuery.data.find((a: any) => a.id === "disparo")
            ?.default_message || "Oi, tudo bem? 😊",
        pause_minutes:
          agentsQuery.data.find((a: any) => a.id === "disparo")
            ?.pause_minutes ?? 0,
        pause_definitive:
          !!agentsQuery.data.find((a: any) => a.id === "disparo")
            ?.pause_definitive,
        agenda_link:
          agentsQuery.data.find((a: any) => a.id === "disparo")?.agenda_link ||
          "",
        human_number:
          agentsQuery.data.find((a: any) => a.id === "disparo")?.human_number ||
          "",
        human_group_id:
          agentsQuery.data.find((a: any) => a.id === "disparo")
            ?.human_group_id || "",
      },
      atendimento: {
        id: "atendimento",
        name: "Agente de Atendimento",
        type: "attendance",
        base_prompt:
          agentsQuery.data.find((a: any) => a.id === "atendimento")
            ?.base_prompt || "",
        default_message:
          agentsQuery.data.find((a: any) => a.id === "atendimento")
            ?.default_message || "",
        pause_minutes:
          agentsQuery.data.find((a: any) => a.id === "atendimento")
            ?.pause_minutes ?? 12,
        pause_definitive:
          !!agentsQuery.data.find((a: any) => a.id === "atendimento")
            ?.pause_definitive,
        agenda_link:
          agentsQuery.data.find((a: any) => a.id === "atendimento")
            ?.agenda_link || "",
        human_number:
          agentsQuery.data.find((a: any) => a.id === "atendimento")
            ?.human_number || "",
        human_group_id:
          agentsQuery.data.find((a: any) => a.id === "atendimento")
            ?.human_group_id || "",
      },
      agendamento: {
        id: "agendamento",
        name: "Agente de Agendamento",
        type: "scheduling",
        base_prompt:
          agentsQuery.data.find((a: any) => a.id === "agendamento")
            ?.base_prompt || "",
        default_message:
          agentsQuery.data.find((a: any) => a.id === "agendamento")
            ?.default_message || "",
        pause_minutes:
          agentsQuery.data.find((a: any) => a.id === "agendamento")
            ?.pause_minutes ?? 0,
        pause_definitive:
          !!agentsQuery.data.find((a: any) => a.id === "agendamento")
            ?.pause_definitive,
        agenda_link:
          agentsQuery.data.find((a: any) => a.id === "agendamento")
            ?.agenda_link || "",
        human_number:
          agentsQuery.data.find((a: any) => a.id === "agendamento")
            ?.human_number || "",
        human_group_id:
          agentsQuery.data.find((a: any) => a.id === "agendamento")
            ?.human_group_id || "",
      },
    };

    setForms(byId);
  }, [agentsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload: AgentFormState) =>
      api.saveAgents([
        {
          id: payload.id,
          name: payload.name,
          type: payload.type,
          base_prompt: payload.base_prompt,
          default_message: payload.default_message,
          pause_minutes: payload.pause_minutes,
          pause_definitive: payload.pause_definitive,
          agenda_link: payload.agenda_link,
          human_number: payload.human_number,
          human_group_id: payload.human_group_id,
        },
      ]),
    onSuccess: () => {
      toast({
        title: "Agente salvo",
        description: "As configurações do agente foram atualizadas.",
      });
    },
  });

  if (!forms) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = forms[activeTab];

  const updateField = (id: AgentId, patch: Partial<AgentFormState>) => {
    setForms((prev) => (prev ? { ...prev, [id]: { ...prev[id], ...patch } } : prev));
  };

  const renderDisparo = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Agente de Disparo
          </h2>
          <p className="text-xs text-muted-foreground">
            Defina o prompt base e a mensagem padrão para disparos/broadcast.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">
          Prompt do agente de disparo
        </Label>
        <Textarea
          className="min-h-[220px] bg-secondary border-border/50 text-xs leading-relaxed"
          value={current.base_prompt}
          onChange={(e) =>
            updateField("disparo", { base_prompt: e.target.value })
          }
        />
        <p className="text-[11px] text-muted-foreground">
          Dica: seja explícito sobre tom, limites de envio e conteúdo proibido.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Mensagem padrão</Label>
        <Textarea
          className="min-h-[60px] bg-secondary border-border/50 text-sm"
          value={current.default_message}
          onChange={(e) =>
            updateField("disparo", { default_message: e.target.value })
          }
          placeholder="Oi, tudo bem? 😊"
        />
        <p className="text-[11px] text-muted-foreground">
          Sugestão: inclua saudação, apresentação curta, objetivo e CTA.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateField("disparo", {
              base_prompt: DISPARO_PROMPT_DEFAULT,
              default_message: "Oi, tudo bem? 😊",
            })
          }
        >
          Limpar
        </Button>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate(forms.disparo)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );

  const renderAtendimento = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <MessageCircle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Agente de Atendimento
          </h2>
          <p className="text-xs text-muted-foreground">
            Prompt base do agente que responde leads e conduz a conversa.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">Prompt do agente</Label>
        <Textarea
          className="min-h-[200px] bg-secondary border-border/50 text-xs leading-relaxed"
          placeholder={ATENDIMENTO_PROMPT_PLACEHOLDER}
          value={current.base_prompt}
          onChange={(e) =>
            updateField("atendimento", { base_prompt: e.target.value })
          }
        />
        <p className="text-[11px] text-muted-foreground">
          Dica: descreva tom de voz, regras do negócio, quando transferir para
          humano, etc.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          Pausa após interação humana
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Controle quando o agente retoma automaticamente após sua intervenção.
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            Pausar o Agente de IA após interação humana por
          </span>
          <Input
            type="number"
            min={0}
            className="w-20 h-7 bg-secondary border-border/50"
            value={current.pause_minutes}
            onChange={(e) =>
              updateField("atendimento", {
                pause_minutes: Number(e.target.value) || 0,
              })
            }
          />
          <span className="text-muted-foreground">minutos</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <div>
            <p className="text-foreground">Pausa definitiva</p>
            <p className="text-[11px] text-muted-foreground">
              Se ativar, o agente não volta a responder automaticamente.
            </p>
          </div>
          <Switch
            checked={current.pause_definitive}
            onCheckedChange={(v) =>
              updateField("atendimento", { pause_definitive: v })
            }
          />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-4">
        <h3 className="text-xs font-semibold text-foreground">
          Itens padrões (tokens para o prompt)
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">🗓️ Agenda</Label>
            <Input
              className="h-8 bg-secondary border-border/50 text-xs"
              placeholder="https://cal.com/seu-usuario"
              value={current.agenda_link}
              onChange={(e) =>
                updateField("atendimento", { agenda_link: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              👤 Número falar com humano
            </Label>
            <Input
              className="h-8 bg-secondary border-border/50 text-xs"
              placeholder="5511999999999"
              value={current.human_number}
              onChange={(e) =>
                updateField("atendimento", { human_number: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              👥 Grupo falar com humano
            </Label>
            <Input
              className="h-8 bg-secondary border-border/50 text-xs"
              placeholder="1234567890-123456@g.us"
              value={current.human_group_id}
              onChange={(e) =>
                updateField("atendimento", { human_group_id: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate(forms.atendimento)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );

  const renderAgendamento = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <CalendarClock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Agente de Agendamento
          </h2>
          <p className="text-xs text-muted-foreground">
            Prompt base usado para detectar intenção de reunião e sugerir horários.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground">
          Prompt do agente de agendamento
        </Label>
        <Textarea
          className="min-h-[200px] bg-secondary border-border/50 text-xs leading-relaxed"
          placeholder={AGENDAMENTO_PROMPT_PLACEHOLDER}
          value={current.base_prompt}
          onChange={(e) =>
            updateField("agendamento", { base_prompt: e.target.value })
          }
        />
      </div>

      <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-4">
        <h3 className="text-xs font-semibold text-foreground">
          Itens padrões (tokens para o prompt)
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">🗓️ Agenda</Label>
            <Input
              className="h-8 bg-secondary border-border/50 text-xs"
              placeholder="https://cal.com/seu-usuario"
              value={current.agenda_link}
              onChange={(e) =>
                updateField("agendamento", { agenda_link: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              👤 Número falar com humano
            </Label>
            <Input
              className="h-8 bg-secondary border-border/50 text-xs"
              placeholder="5511999999999"
              value={current.human_number}
              onChange={(e) =>
                updateField("agendamento", { human_number: e.target.value })
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              👥 Grupo falar com humano
            </Label>
            <Input
              className="h-8 bg-secondary border-border/50 text-xs"
              placeholder="1234567890-123456@g.us"
              value={current.human_group_id}
              onChange={(e) =>
                updateField("agendamento", { human_group_id: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate(forms.agendamento)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-slide-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agentes de IA</h1>
        <p className="text-sm text-muted-foreground">
          Configure os agentes de disparo, atendimento e agendamento usados pelo seu bot.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as AgentId)}
        className="space-y-4"
      >
        <TabsList className="bg-secondary border border-border/50">
          <TabsTrigger value="disparo">Agente de Disparo</TabsTrigger>
          <TabsTrigger value="atendimento">Agente de Atendimento</TabsTrigger>
          <TabsTrigger value="agendamento">Agente de Agendamento</TabsTrigger>
        </TabsList>

        <TabsContent value="disparo">{renderDisparo()}</TabsContent>
        <TabsContent value="atendimento">{renderAtendimento()}</TabsContent>
        <TabsContent value="agendamento">{renderAgendamento()}</TabsContent>
      </Tabs>
    </div>
  );
}
