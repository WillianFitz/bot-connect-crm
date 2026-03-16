import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  MessageCircle,
  CalendarClock,
  Loader2,
  Upload,
  Trash2,
  RefreshCw,
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

// ─── Token visual system ────────────────────────────────────────────────────

interface TokenVisual {
  token: string;
  label: string;
  emoji: string;
  chipClass: string;   // tailwind classes for the draggable chip (in tools panel)
  badgeClass: string;  // tailwind classes for the inline badge (in editor)
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;");
}
function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DEFAULT_TOKEN_VISUALS: TokenVisual[] = [
  {
    token: "{{agenda}}",
    label: "Agenda",
    emoji: "🗓️",
    chipClass:
      "bg-amber-500/20 border-amber-400/60 text-amber-300 hover:bg-amber-500/30",
    badgeClass:
      "bg-amber-500/20 border-amber-400/60 text-amber-300",
  },
  {
    token: "{{numero_humano}}",
    label: "Falar com Humano",
    emoji: "👤",
    chipClass:
      "bg-blue-500/20 border-blue-400/60 text-blue-300 hover:bg-blue-500/30",
    badgeClass:
      "bg-blue-500/20 border-blue-400/60 text-blue-300",
  },
  {
    token: "{{grupo_humano}}",
    label: "Grupo Humano",
    emoji: "👥",
    chipClass:
      "bg-cyan-500/20 border-cyan-400/60 text-cyan-300 hover:bg-cyan-500/30",
    badgeClass:
      "bg-cyan-500/20 border-cyan-400/60 text-cyan-300",
  },
];

interface AgentMedia {
  id: number;
  media_id: string;
  file_name: string;
  media_type: string;
  created_at: string;
}

function buildMediaVisual(m: AgentMedia): TokenVisual {
  const token = `{{media:${m.media_id}}}`;
  if (m.media_type.startsWith("video/"))
    return {
      token,
      label: `Enviar Vídeo • ${m.media_id}`,
      emoji: "🎥",
      chipClass:
        "bg-violet-500/20 border-violet-400/60 text-violet-300 hover:bg-violet-500/30",
      badgeClass: "bg-violet-500/20 border-violet-400/60 text-violet-300",
    };
  if (m.media_type.startsWith("audio/"))
    return {
      token,
      label: `Enviar Áudio • ${m.media_id}`,
      emoji: "🎵",
      chipClass:
        "bg-pink-500/20 border-pink-400/60 text-pink-300 hover:bg-pink-500/30",
      badgeClass: "bg-pink-500/20 border-pink-400/60 text-pink-300",
    };
  if (m.media_type.startsWith("image/"))
    return {
      token,
      label: `Enviar Imagem • ${m.media_id}`,
      emoji: "🖼️",
      chipClass:
        "bg-emerald-500/20 border-emerald-400/60 text-emerald-300 hover:bg-emerald-500/30",
      badgeClass: "bg-emerald-500/20 border-emerald-400/60 text-emerald-300",
    };
  return {
    token,
    label: `Enviar Arquivo • ${m.media_id}`,
    emoji: "📎",
    chipClass:
      "bg-gray-500/20 border-gray-400/60 text-gray-300 hover:bg-gray-500/30",
    badgeClass: "bg-gray-500/20 border-gray-400/60 text-gray-300",
  };
}

// Converts stored string (with {{token}} markers) to editor HTML
function valueToHTML(text: string, visuals: TokenVisual[]): string {
  if (!visuals.length) return escapeHtml(text).replace(/\n/g, "<br>");
  const pattern = new RegExp(
    `(${visuals.map((v) => escapeRegex(v.token)).join("|")})`,
  );
  return text
    .split(pattern)
    .map((part) => {
      const v = visuals.find((x) => x.token === part);
      if (v) {
        return `<span data-token="${escapeAttr(v.token)}" contenteditable="false" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold mx-0.5 align-middle cursor-default select-none ${v.badgeClass}">${v.emoji} ${escapeHtml(v.label)}</span>`;
      }
      return escapeHtml(part).replace(/\n/g, "<br>");
    })
    .join("");
}

// Serialises editor DOM back to the stored string
function htmlToValue(div: HTMLDivElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.dataset.token) return el.dataset.token;
      if (el.tagName === "BR") return "\n";
      if (el.tagName === "DIV")
        return "\n" + Array.from(el.childNodes).map(walk).join("");
      return Array.from(el.childNodes).map(walk).join("");
    }
    return "";
  }
  return Array.from(div.childNodes).map(walk).join("");
}

// ─── RichPromptEditor ────────────────────────────────────────────────────────

interface RichPromptEditorProps {
  value: string;
  onChange: (v: string) => void;
  visuals: TokenVisual[];
  placeholder?: string;
}

function RichPromptEditor({
  value,
  onChange,
  visuals,
  placeholder,
}: RichPromptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef(value);
  const lastVisualsRef = useRef(visuals);

  // Sync DOM when value/visuals change from outside
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const visualsChanged = visuals !== lastVisualsRef.current;
    lastVisualsRef.current = visuals;
    if (!visualsChanged && value === internalRef.current) return;
    internalRef.current = value;
    // Save / restore selection
    const sel = window.getSelection();
    const hadFocus = document.activeElement === el;
    el.innerHTML = valueToHTML(value, visuals);
    if (hadFocus && sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [value, visuals]);

  // Initial render
  useEffect(() => {
    if (editorRef.current)
      editorRef.current.innerHTML = valueToHTML(value, visuals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const newVal = htmlToValue(el);
    internalRef.current = newVal;
    onChange(newVal);
  }, [onChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const token = e.dataTransfer.getData("text/plain");
      if (!token) return;
      const visual = visuals.find((v) => v.token === token);
      const el = editorRef.current;
      if (!el) return;

      // Position caret at drop point
      let range: Range | null = null;
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
        }
      } else if ((document as any).caretRangeFromPoint) {
        range = (document as any).caretRangeFromPoint(e.clientX, e.clientY);
      }
      const sel = window.getSelection();
      if (range && sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }

      if (visual) {
        const span = document.createElement("span");
        span.dataset.token = visual.token;
        span.contentEditable = "false";
        span.className = `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold mx-0.5 align-middle cursor-default select-none ${visual.badgeClass}`;
        span.draggable = false;
        span.textContent = `${visual.emoji} ${visual.label}`;
        if (sel && sel.rangeCount > 0) {
          const r = sel.getRangeAt(0);
          r.deleteContents();
          r.insertNode(span);
          r.setStartAfter(span);
          r.setEndAfter(span);
          sel.removeAllRanges();
          sel.addRange(r);
        } else {
          el.appendChild(span);
        }
      } else {
        // Fallback: plain text insertion
        document.execCommand("insertText", false, token);
      }
      handleInput();
    },
    [visuals, handleInput],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    document.execCommand(
      "insertText",
      false,
      e.clipboardData.getData("text/plain"),
    );
  }, []);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onPaste={handlePaste}
      data-placeholder={placeholder}
      className={[
        "min-h-[320px] max-h-[560px] overflow-y-auto p-3 rounded-md border border-border/50",
        "bg-secondary text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring",
        "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40",
        "whitespace-pre-wrap break-words",
      ].join(" ")}
    />
  );
}

// ─── ToolChip (draggable button in the tools panel) ─────────────────────────

function ToolChip({ visual }: { visual: TokenVisual }) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", visual.token);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title="Arraste para o prompt"
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
        "text-xs font-semibold cursor-grab active:cursor-grabbing select-none",
        "transition-all duration-150",
        visual.chipClass,
      ].join(" ")}
    >
      <span className="text-sm leading-none">{visual.emoji}</span>
      <span>{visual.label}</span>
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

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: api.getAgents,
  });

  const mediaQuery = useQuery({
    queryKey: ["agent-media"],
    queryFn: api.getAgentMedia,
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


  const handleUploadMedia = async () => {
    if (!mediaFile || !mediaName.trim()) return;
    if (!/^[a-z0-9_\-]+$/.test(mediaName.trim())) {
      toast({ title: "Nome/ID inválido", description: "Use apenas letras minúsculas, números, _ e -", variant: "destructive" });
      return;
    }
    // 50 MB frontend guard (R2 supports much more, but WhatsApp limits to ~64 MB)
    if (mediaFile.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Limite: 50 MB", variant: "destructive" });
      return;
    }
    setIsUploadingMedia(true);
    try {
      await api.uploadAgentMedia(mediaFile, mediaName.trim());
      queryClient.invalidateQueries({ queryKey: ["agent-media"] });
      toast({ title: "Mídia enviada!", description: `Token: {{media:${mediaName.trim()}}}` });
      setMediaFile(null);
      setMediaName("");
      const inp = document.getElementById("media-file-input") as HTMLInputElement | null;
      if (inp) inp.value = "";
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message ?? "Erro desconhecido", variant: "destructive" });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const renderAtendimento = () => {
    const rawMediaList = mediaQuery.data ?? [];
    const charCount = forms?.atendimento.base_prompt.length ?? 0;

    // Build all token visuals (defaults + media)
    const mediaVisuals = rawMediaList.map(buildMediaVisual);
    const allVisuals: TokenVisual[] = [...DEFAULT_TOKEN_VISUALS, ...mediaVisuals];

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


        {/* Ferramentas */}
        <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
          <h3 className="text-xs font-semibold text-foreground">Minhas Ferramentas</h3>
          <p className="text-[11px] text-muted-foreground">
            Arraste qualquer botão abaixo para o local correto no prompt.
          </p>

          {/* Tokens padrões */}
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-semibold">
              Ações padrão
            </p>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_TOKEN_VISUALS.map((v) => (
                <ToolChip key={v.token} visual={v} />
              ))}
            </div>
          </div>

          {/* Mídias */}
          {mediaVisuals.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-semibold">
                Mídias enviadas
              </p>
              <div className="flex flex-wrap gap-2">
                {mediaVisuals.map((v) => (
                  <ToolChip key={v.token} visual={v} />
                ))}
              </div>
            </div>
          )}

          {rawMediaList.length === 0 && (
            <p className="text-[11px] text-muted-foreground/60 italic">
              Nenhuma mídia enviada ainda. Envie na seção abaixo para adicionar botões de vídeo, áudio e imagem.
            </p>
          )}
        </div>

        {/* Editor de Prompt */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground font-semibold">Prompt do agente</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={() => clearMemoryMutation.mutate()}
              disabled={clearMemoryMutation.isPending}
            >
              🧹 Limpar memória do agente para testes
            </Button>
          </div>

          <RichPromptEditor
            value={current.base_prompt}
            onChange={(v) => updateField("atendimento", { base_prompt: v })}
            visuals={allVisuals}
            placeholder={ATENDIMENTO_PROMPT_PLACEHOLDER}
          />

          <div className="flex items-center justify-between">
            <span className={`text-[11px] ${charCount > 8000 ? "text-destructive" : "text-muted-foreground"}`}>
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
              onChange={(e) => updateField("atendimento", { pause_minutes: Number(e.target.value) || 0 })}
            />
            <span className="text-muted-foreground">minutos</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <div>
              <p className="text-foreground font-medium">Pausa definitiva</p>
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
            💡 Dica: defina 0 para não pausar. Se marcar Pausa definitiva, o agente não voltará a responder automaticamente.
          </p>
        </div>

        {/* Itens padrões */}
        <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-foreground">Itens padrões</h3>
          <p className="text-[11px] text-muted-foreground">
            Configure os valores dos tokens. Arraste os botões da seção "Minhas Ferramentas" para inserir no prompt.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">🗓️ Agenda</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs flex-1"
                  placeholder="https://cal.com/seu-usuario | https://calendar.app..."
                  value={current.agenda_link}
                  onChange={(e) => updateField("atendimento", { agenda_link: e.target.value })}
                />
                <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => saveMutation.mutate(forms!.atendimento)} disabled={saveMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">👤 Número falar com humano</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs flex-1"
                  placeholder="5511999999999"
                  value={current.human_number}
                  onChange={(e) => updateField("atendimento", { human_number: e.target.value })}
                />
                <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => saveMutation.mutate(forms!.atendimento)} disabled={saveMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">👥 Grupo falar com humano</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs flex-1"
                  placeholder="1234567890-123456@g.us"
                  value={current.human_group_id}
                  onChange={(e) => updateField("atendimento", { human_group_id: e.target.value })}
                />
                <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => saveMutation.mutate(forms!.atendimento)} disabled={saveMutation.isPending}>
                  Salvar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mídias do agente */}
        <div className="space-y-4 rounded-xl border border-border/50 bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Mídias do agente
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
            Cadastre a URL pública de cada mídia. O bot usa a URL para enviar imagem, áudio ou vídeo via WhatsApp.
            Hospede seus arquivos em qualquer lugar (Google Drive link direto, Dropbox, servidor próprio, etc.)
          </p>

          {/* Formulário */}
          <div className="space-y-3 rounded-lg border border-dashed border-border/60 bg-background/30 p-4">
            <p className="text-xs font-semibold text-foreground">Nova mídia</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Arquivo</Label>
                <input
                  id="media-file-input"
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setMediaFile(f);
                    if (f && !mediaName) {
                      // Auto-fill ID from filename
                      const auto = f.name.split(".")[0]!
                        .toLowerCase()
                        .replace(/[^a-z0-9_\-]/g, "_")
                        .replace(/_+/g, "_")
                        .slice(0, 40);
                      setMediaName(auto);
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground">
                  Imagem, vídeo ou áudio · máx. 50 MB
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">ID do token</Label>
                <Input
                  className="h-8 bg-secondary border-border/50 text-xs font-mono"
                  placeholder="ex.: video_apresentacao"
                  value={mediaName}
                  onChange={(e) => setMediaName(e.target.value.toLowerCase().replace(/[^a-z0-9_\-]/g, ""))}
                />
                <p className="text-[10px] text-muted-foreground">
                  Token no prompt: <span className="font-mono text-primary/80">{"{{media:" + (mediaName || "id") + "}}"}</span>
                </p>
              </div>
            </div>

            <Button
              size="sm"
              className="gap-2"
              onClick={handleUploadMedia}
              disabled={!mediaFile || !mediaName.trim() || isUploadingMedia}
            >
              {isUploadingMedia
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando para R2...</>
                : <><Upload className="h-3.5 w-3.5" /> Enviar mídia</>
              }
            </Button>
          </div>

          {/* Biblioteca */}
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest font-semibold">
              Biblioteca — {rawMediaList.length} {rawMediaList.length === 1 ? "mídia" : "mídias"}
            </p>
            {mediaQuery.isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
              </div>
            )}
            {!mediaQuery.isLoading && rawMediaList.length === 0 && (
              <p className="text-[11px] text-muted-foreground italic py-2">Nenhuma mídia cadastrada ainda.</p>
            )}
            {rawMediaList.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {rawMediaList.map((m) => {
                  const v = buildMediaVisual(m);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-secondary/50 p-2.5 group"
                    >
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold shrink-0 ${v.badgeClass}`}>
                        <span>{v.emoji}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{m.file_name}</p>
                        <p className="text-[10px] text-muted-foreground/70 truncate font-mono">{m.media_id}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
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
