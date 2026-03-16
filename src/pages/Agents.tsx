import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  MessageCircle,
  CalendarClock,
  Loader2,
  Upload,
  Trash2,
  GripHorizontal,
  RefreshCw,
  FileVideo,
  FileAudio,
  FileImage,
  File as FileIcon,
} from "lucide-react";
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

const DISPARO_PROMPT_DEFAULT = `🎯 Agente de Disparos (prospecção ativa):
Você gera a *primeira mensagem* que a EMPRESA envia para um LEAD. Ou seja: *a empresa está entrando em contato com o lead* (não o contrário). O lead ainda não te chamou — você está fazendo prospecção.

❌ NÃO use "Como posso ajudar?", "Em que posso ajudar?" — isso é para quando o CLIENTE te liga. Aqui quem inicia é a empresa.
✅ Use uma saudação de quem *está iniciando* o contato: cumprimentar, se apresentar ou puxar assunto de forma breve.

---

💬 Regras de mensagem:
- Escolha *apenas uma* saudação por vez.
- A saudação deve parecer espontânea, natural e diferente em cada envio.
- *Não* use “bom dia”, “boa tarde” ou “boa noite”.
- *Não adicione* nada além da saudação (sem assinatura, sem texto extra).
- Use variações simples e neutras. Pode usar o nome do lead na saudação (ex.: "Oi, [nome]! Tudo bem?").
- Tom: quem inicia o contato é a empresa (prospecção), não o lead. Evite frases de atendimento.

Escolha *aleatoriamente* entre as opções abaixo (ou pequenas variações delas):
- "Olá, tudo bem?"
- "Olá, como vai?"
- "Oi, tudo certo?"
- "Olá, tudo bem?"
- "Oi, tudo bom?"
- "Olá 👋"
- "Oi, tudo jóia?"

Use o nome da minha empresa na saudação. Nome da minha empresa: LeadFlowAI.
Peça se ele tem 1 minuto da atenção dele para uma proposta da minha empresa.

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

const ATENDIMENTO_PROMPT_DEFAULT = `## 🤖 Agente Evolua Prospect
Você é um agente virtual da Evolua Prospect, uma empresa especializada em soluções de prospecção e tecnologia. Seu objetivo é conduzir uma conversa natural e amigável com potenciais clientes, seguindo um fluxo específico de qualificação.

### Personalidade e Tom:
Seja cordial, profissional e acolhedor
Use uma linguagem natural e conversacional
Mantenha respostas concisas e diretas
Demonstre interesse genuíno pelas respostas do prospect
Evite parecer robotizado - seja humano na comunicação

### Fluxo de Conversa Obrigatório:

** ETAPA 1: Apresentação e Coleta de Nome
Ação: Apresente-se como agente da Evolua Prospect e pergunte o nome do prospect.
Exemplo: "Oi! Tudo bem? Sou da Evolua Prospect 😄
Tenho uma solução incrível pra te ajudar a vender mais! Me diz uma coisa rapidinho, qual é o seu nome?"
Aguarde a resposta antes de prosseguir.

** ETAPA 2: Pergunta de envio de mídia
Ação: Pergunte se pode enviar um vídeo
Exemplo: "Prazer em conhecê-lo, [Nome]! Posso te mostrar um vídeo bem rápido sobre como funciona a Evolua Prospect?"
Aguarde a resposta antes de prosseguir.

** ETAPA 3: Envio de vídeo
Ação: Após resposta positiva, envie o vídeo:
{{media:video_demo1}}

** ETAPA 4: Pergunta de envio de áudio
Ação: Pergunte se pode enviar um áudio
Exemplo: "Posso lhe enviar um áudio bem curto, explicando todos os diferenciais da Evolua Prospect?"

** ETAPA 5: Envio de Áudio
Ação: Após resposta positiva:
{{media:audio_demo1}}

** ETAPA 6: Pergunta de agendamento
Ação: Pergunte se o prospect gostaria de agendar uma reunião
Exemplo: "O que acha de agendarmos uma reunião para apresentação da plataforma?"
Aguarde a resposta antes de prosseguir.

** ETAPA 7: Envio da Agenda
Ação: Após resposta positiva:
{{agenda}}
Exemplo: "Acabei de te enviar o link da nossa agenda 😉 Assim que marcar um horário por lá, me avisa por favor?"

** ETAPA 8: Confirmação do agendamento
Ação: Após confirmação:
{{media:imagem_confirmacao}}
Exemplo: "Legal, vou avisar nosso time comercial"

### Regras Importantes
⚠️ REGRA CRÍTICA: UMA AÇÃO POR VEZ
NUNCA execute mais de uma tool na mesma resposta. Você deve:
Executar UMA tool → PARAR → aguardar a próxima interação → só então prosseguir.

Outras Regras:
- Siga o fluxo na ordem exata - não pule etapas
- Aguarde sempre a resposta do usuário antes de prosseguir
- Número para falar com humano: {{numero_humano}}`;

function mediaIcon(type: string) {
  if (type.startsWith("video/")) return FileVideo;
  if (type.startsWith("audio/")) return FileAudio;
  if (type.startsWith("image/")) return FileImage;
  return FileIcon;
}

interface DraggableChipProps {
  token: string;
  label: string;
  icon?: React.ReactNode;
}

function DraggableChip({ token, label, icon }: DraggableChipProps) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", token);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={`Arraste para o prompt: ${token}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs text-primary cursor-grab hover:bg-primary/20 active:cursor-grabbing select-none transition-colors"
    >
      {icon ?? <GripHorizontal className="h-3 w-3 opacity-60" />}
      <span className="font-mono">{label}</span>
    </div>
  );
}

const AGENDAMENTO_PROMPT_PLACEHOLDER =
  "Insira o prompt base do seu agente de agendamento.\nEx: como identificar intenção de reunião, como sugerir horários, como usar o link da agenda etc.";

export default function Agents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AgentId>("disparo");
  const [forms, setForms] = useState<Record<AgentId, AgentFormState> | null>(null);

  // Media upload state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const whatsappQuery = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: api.getWhatsappConnection,
  });

  const mediaQuery = useQuery({
    queryKey: ["agent-media"],
    queryFn: api.getAgentMedia,
  });

  const updateConnectionMutation = useMutation({
    mutationFn: (payload: { agent_enabled?: boolean; reply_all?: boolean }) =>
      api.updateWhatsappConnection(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection"] });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: (id: number) => api.deleteAgentMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-media"] });
      toast({ title: "Mídia removida" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao remover mídia", description: err.message, variant: "destructive" });
    },
  });

  const clearMemoryMutation = useMutation({
    mutationFn: () => api.clearAgentMemory(),
    onSuccess: () => {
      toast({ title: "Memória limpa", description: "Contexto de conversa resetado para testes." });
    },
  });

  useEffect(() => {
    if (!agentsQuery.data) return;

    const byId: Record<AgentId, AgentFormState> = {
      disparo: {
        id: "disparo",
        name: "Agente de Disparo",
        type: "attendance",
        base_prompt:
          agentsQuery.data.find((a: any) => a.id === "disparo")?.base_prompt ?? "",
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
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      toast({
        title: "Agente salvo",
        description: "Próximos disparos usarão o prompt e a mensagem padrão que você configurou.",
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
        <p className="text-[11px] text-muted-foreground mt-0.5">
          O que você escrever aqui é o que a IA usa para gerar a mensagem. Use o botão &quot;Usar prompt pronto&quot; para carregar um modelo de prospecção.
        </p>
        <Textarea
          className="min-h-[220px] bg-secondary border-border/50 text-xs leading-relaxed"
          value={current.base_prompt}
          onChange={(e) =>
            updateField("disparo", { base_prompt: e.target.value })
          }
          placeholder="Ex.: Envie apenas a mensagem: Olá! Ou descreva as regras para a IA gerar a mensagem (tom, saudação, CTA)."
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
          title="Carrega o prompt recomendado (prospecção: empresa contatando o lead)"
        >
          Usar prompt pronto
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

  const handlePromptDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const token = e.dataTransfer.getData("text/plain");
    if (!token || !forms) return;
    const textarea = e.currentTarget;
    const pos = textarea.selectionStart ?? textarea.value.length;
    const val = forms.atendimento.base_prompt;
    const newVal = val.slice(0, pos) + token + val.slice(pos);
    updateField("atendimento", { base_prompt: newVal });
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = pos + token.length;
    }, 0);
  };

  const handleUploadMedia = async () => {
    if (!mediaFile || !mediaName.trim()) return;
    if (!/^[a-z0-9_\-]+$/.test(mediaName.trim())) {
      toast({
        title: "Nome inválido",
        description: "Use apenas letras minúsculas, números, _ e -",
        variant: "destructive",
      });
      return;
    }
    setIsUploadingMedia(true);
    try {
      await api.uploadAgentMedia(mediaFile, mediaName.trim(), mediaFile.name);
      queryClient.invalidateQueries({ queryKey: ["agent-media"] });
      toast({ title: "Mídia enviada", description: `Token: {{media:${mediaName.trim()}}}` });
      setMediaFile(null);
      setMediaName("");
      (document.getElementById("media-file-input") as HTMLInputElement | null)!.value = "";
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const renderAtendimento = () => {
    const conn = whatsappQuery.data;
    const mediaList = mediaQuery.data ?? [];
    const charCount = forms?.atendimento.base_prompt.length ?? 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Agente de Atendimento</h2>
            <p className="text-xs text-muted-foreground">
              Defina o prompt base usado pelo seu agente de atendimento.
            </p>
          </div>
        </div>

        {/* Toggles de comportamento */}
        <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-foreground">Comportamento do Agente</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground font-medium">Agente de atendimento ligado</p>
                <p className="text-[11px] text-muted-foreground">
                  Responde apenas leads com quem você já iniciou uma conversa (prospecção ativa).
                </p>
              </div>
              <Switch
                checked={!!conn?.agent_enabled}
                disabled={updateConnectionMutation.isPending}
                onCheckedChange={(v) =>
                  updateConnectionMutation.mutate({ agent_enabled: v })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-foreground font-medium">Responder todos</p>
                <p className="text-[11px] text-muted-foreground">
                  Quando ativado, o agente responde <strong>qualquer pessoa</strong> que entrar em contato no WhatsApp.
                </p>
              </div>
              <Switch
                checked={!!conn?.reply_all}
                disabled={updateConnectionMutation.isPending || !conn?.agent_enabled}
                onCheckedChange={(v) =>
                  updateConnectionMutation.mutate({ reply_all: v })
                }
              />
            </div>
          </div>
        </div>

        {/* Ferramentas + Prompt - layout lado a lado em telas grandes */}
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          {/* Painel de ferramentas */}
          <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
            <h3 className="text-xs font-semibold text-foreground">Minhas Ferramentas</h3>
            <p className="text-[11px] text-muted-foreground">
              Arraste a ferramenta para o local correto no seu prompt.
            </p>

            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                Tokens padrões
              </p>
              <div className="flex flex-wrap gap-2">
                <DraggableChip token="{{agenda}}" label="{{agenda}}" icon={<span className="text-xs">🗓️</span>} />
                <DraggableChip token="{{numero_humano}}" label="{{numero_humano}}" icon={<span className="text-xs">👤</span>} />
                <DraggableChip token="{{grupo_humano}}" label="{{grupo_humano}}" icon={<span className="text-xs">👥</span>} />
              </div>
            </div>

            {mediaList.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                  Mídias
                </p>
                <div className="flex flex-wrap gap-2">
                  {mediaList.map((m) => {
                    const Icon = mediaIcon(m.media_type);
                    return (
                      <DraggableChip
                        key={m.id}
                        token={`{{media:${m.media_id}}}`}
                        label={m.media_id}
                        icon={<Icon className="h-3 w-3" />}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {mediaList.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic">
                Sem mídias. Envie na seção abaixo.
              </p>
            )}
          </div>

          {/* Editor de Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Prompt do agente</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => clearMemoryMutation.mutate()}
                disabled={clearMemoryMutation.isPending}
                title="Limpa o histórico de conversa para testes"
              >
                🧹 Limpar memória do agente para testes
              </Button>
            </div>
            <Textarea
              ref={promptRef}
              className="min-h-[320px] bg-secondary border-border/50 text-xs leading-relaxed font-mono resize-y"
              placeholder={ATENDIMENTO_PROMPT_PLACEHOLDER}
              value={current.base_prompt}
              onChange={(e) => updateField("atendimento", { base_prompt: e.target.value })}
              onDrop={handlePromptDrop}
              onDragOver={(e) => e.preventDefault()}
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] ${charCount > 8000 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {charCount}/8000 caracteres
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => updateField("atendimento", { base_prompt: "" })}
                >
                  Limpar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => updateField("atendimento", { base_prompt: ATENDIMENTO_PROMPT_DEFAULT })}
                >
                  Usar prompt pronto
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => saveMutation.mutate(forms!.atendimento)}
                  disabled={saveMutation.isPending || charCount > 8000}
                >
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Pausa após interação humana */}
        <div className="space-y-3 rounded-xl border border-border/50 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Pausa após interação humana
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Controle quando o agente retoma automaticamente após sua intervenção.
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Pausar o Agente de IA após interação humana por</span>
            <Input
              type="number"
              min={0}
              className="w-20 h-7 bg-secondary border-border/50"
              value={current.pause_minutes}
              onChange={(e) =>
                updateField("atendimento", { pause_minutes: Number(e.target.value) || 0 })
              }
            />
            <span className="text-muted-foreground">minutos</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="text-foreground">Pausa definitiva</p>
              <p className="text-[11px] text-muted-foreground">
                Se ativar, o agente não volta a responder automaticamente após sua interação.
              </p>
            </div>
            <Switch
              checked={current.pause_definitive}
              onCheckedChange={(v) => updateField("atendimento", { pause_definitive: v })}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            💡 Dica: defina 0 para não pausar. Se marcar Pausa definitiva, o agente não voltará a responder automaticamente após sua interação.
          </p>
        </div>

        {/* Itens padrões */}
        <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-foreground">Itens padrões</h3>
          <p className="text-[11px] text-muted-foreground">
            Use estes itens como tokens no prompt. Arraste da seção "Minhas Ferramentas" para inserir no prompt.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">🗓️ Agenda</Label>
              <p className="text-[11px] text-muted-foreground">{"Defina o link público da sua agenda e insira no prompt como token {{agenda}}."}</p>
              <div className="flex gap-2">
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs flex-1"
                  placeholder="https://cal.com/seu-usuario | https://calendar.app..."
                  value={current.agenda_link}
                  onChange={(e) => updateField("atendimento", { agenda_link: e.target.value })}
                />
                <Button size="sm" className="h-8 text-xs" onClick={() => saveMutation.mutate(forms!.atendimento)} disabled={saveMutation.isPending}>
                  Salvar agenda
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">👤 Número falar com humano</Label>
              <p className="text-[11px] text-muted-foreground">{"Insira no formato 55DDD99999999. Use como token {{numero_humano}}."}</p>
              <div className="flex gap-2">
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs flex-1"
                  placeholder="5511999999999"
                  value={current.human_number}
                  onChange={(e) => updateField("atendimento", { human_number: e.target.value })}
                />
                <Button size="sm" className="h-8 text-xs" onClick={() => saveMutation.mutate(forms!.atendimento)} disabled={saveMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">👥 Grupo falar com humano</Label>
              <p className="text-[11px] text-muted-foreground">{"Insira o ID do grupo (ex.: 1234567890-123456@g.us). Use como token {{grupo_humano}}."}</p>
              <div className="flex gap-2">
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs flex-1"
                  placeholder="1234567890-123456@g.us"
                  value={current.human_group_id}
                  onChange={(e) => updateField("atendimento", { human_group_id: e.target.value })}
                />
                <Button size="sm" className="h-8 text-xs" onClick={() => saveMutation.mutate(forms!.atendimento)} disabled={saveMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Uploads de mídia */}
        <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Uploads de mídia do agente
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["agent-media"] })}
            >
              <RefreshCw className="h-3 w-3" /> Atualizar
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Envie arquivos e gere tokens para usar no prompt. Arraste o token para inserir no prompt do agente.
          </p>

          {/* Formulário de upload */}
          <div className="space-y-3 rounded-lg border border-border/30 bg-background/40 p-3">
            <p className="text-xs font-medium text-foreground">Novo upload</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Arquivo</Label>
                <input
                  id="media-file-input"
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="w-full text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  Nome/ID da mídia
                </Label>
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs font-mono"
                  placeholder="ex.: video_demo1"
                  value={mediaName}
                  onChange={(e) => setMediaName(e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, ""))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Regras: minúsculas, sem acentos, sem espaços. Permitido a-z 0-9 _ -
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleUploadMedia}
              disabled={!mediaFile || !mediaName.trim() || isUploadingMedia}
            >
              {isUploadingMedia ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="h-3 w-3" /> Enviar e salvar</>
              )}
            </Button>
          </div>

          {/* Biblioteca */}
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              Minha biblioteca — {mediaList.length} {mediaList.length === 1 ? "item" : "itens"}
            </p>
            {mediaQuery.isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
              </div>
            )}
            {!mediaQuery.isLoading && mediaList.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic py-2">Nenhuma mídia cadastrada.</p>
            )}
            {mediaList.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {mediaList.map((m) => {
                  const Icon = mediaIcon(m.media_type);
                  const token = `{{media:${m.media_id}}}`;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/50 p-2 group"
                    >
                      <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{m.file_name}</p>
                        <p
                          className="text-[10px] font-mono text-primary truncate cursor-grab"
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData("text/plain", token);
                            e.dataTransfer.effectAllowed = "copy";
                          }}
                          title={`Arraste para o prompt: ${token}`}
                        >
                          {token}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteMediaMutation.mutate(m.id)}
                        disabled={deleteMediaMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
