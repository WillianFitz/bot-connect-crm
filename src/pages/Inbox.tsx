import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, CheckCheck, User, Bot, Send,
  PhoneCall, Inbox, X, PauseCircle, PlayCircle,
} from "lucide-react";

type ConvRow = {
  phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_role: string | null;
  last_message_at: string | null;
  bot_status: "active" | "paused";
  message_count: number;
};

type Msg = { role: "user" | "assistant"; content: string; created_at: string };

function ts(d: string | null) {
  if (!d) return "";
  try {
    const date = new Date(d.endsWith("Z") ? d : d + "Z");
    const m = Math.floor((Date.now() - date.getTime()) / 60_000);
    if (m < 1) return "agora";
    if (m < 60) return `${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function clock(d: string) {
  try {
    return new Date(d.endsWith("Z") ? d : d + "Z")
      .toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export default function InboxPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sel, setSel] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const listQ = useQuery({
    queryKey: ["inbox-list"],
    queryFn: api.getInboxHandoffs,
    refetchInterval: 3_000,
  });

  const msgsQ = useQuery({
    queryKey: ["inbox-msgs", sel],
    queryFn: () => api.getInboxMessages(sel!),
    enabled: !!sel,
    refetchInterval: 2_000,
  });

  const replyM = useMutation({
    mutationFn: async (msg: string) => {
      // Pausa o bot automaticamente se estiver ativo antes de enviar
      const current = listQ.data?.find((c) => c.phone === sel);
      if (current?.bot_status === "active") await api.pauseInboxBot(sel!);
      return api.replyInbox(sel!, msg);
    },
    onMutate: (msg: string) => {
      // Update otimista: adiciona a mensagem imediatamente na tela
      setReply("");
      const optimistic: Msg = { role: "assistant", content: msg, created_at: new Date().toISOString() };
      qc.setQueryData(["inbox-msgs", sel], (old: Msg[] | undefined) => [...(old ?? []), optimistic]);
    },
    onSuccess: () => {
      // Não invalida inbox-msgs aqui — o polling de 2s sincroniza sem flicker
      qc.invalidateQueries({ queryKey: ["inbox-list"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const pauseM = useMutation({
    mutationFn: (phone: string) => api.pauseInboxBot(phone),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox-list"] }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resumeM = useMutation({
    mutationFn: (phone: string) => api.resumeInboxBot(phone),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox-list"] }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const dismissM = useMutation({
    mutationFn: (phone: string) => api.dismissInbox(phone),
    onSuccess: (_, phone) => {
      if (sel === phone) setSel(null);
      qc.invalidateQueries({ queryKey: ["inbox-list"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Scroll to bottom on new messages
  const msgLen = msgsQ.data?.length ?? 0;
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [msgLen]);

  const list = listQ.data ?? [];
  const current = list.find((c) => c.phone === sel) ?? null;
  const msgs = (msgsQ.data ?? []) as Msg[];

  return (
    // Ocupa o espaço disponível dentro do AppLayout sem fazer a página crescer
    <div className="flex flex-col gap-3 animate-slide-in" style={{ height: "calc(100vh - 7rem)" }}>

      {/* Header compacto */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Inbox
            {list.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs h-5 px-1.5">{list.length}</Badge>
            )}
          </h1>
          <p className="text-xs text-muted-foreground">Conversas ativas — some ao descartar, reaparece com nova atividade</p>
        </div>
      </div>

      {/* Grid — ocupa todo o espaço restante */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3 flex-1 min-h-0 overflow-hidden">

        {/* ── Lista ── */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col min-h-0 overflow-hidden">

          {/* Cabeçalho da lista */}
          <div className="px-3 py-2 border-b border-border/40 shrink-0">
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              {list.length === 0 ? "Nenhuma conversa" : `${list.length} conversa${list.length > 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Itens com scroll */}
          <div className="flex-1 overflow-y-auto">
            {listQ.isLoading && (
              <div className="p-4 text-center text-xs text-muted-foreground">Carregando...</div>
            )}
            {!listQ.isLoading && list.length === 0 && (
              <div className="p-6 text-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma conversa ativa</p>
              </div>
            )}
            {list.map((c) => (
              <div
                key={c.phone}
                className={`group relative border-b border-border/20 transition-colors cursor-pointer ${
                  sel === c.phone ? "bg-accent" : "hover:bg-accent/40"
                }`}
                onClick={() => setSel(c.phone)}
              >
                {/* Botão X — descarta */}
                <button
                  className="absolute top-2 right-2 z-10 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                  title="Descartar"
                  onClick={(e) => { e.stopPropagation(); dismissM.mutate(c.phone); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="p-3 pr-8">
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                        c.bot_status === "paused" ? "bg-amber-500/15" : "bg-primary/10"
                      }`}>
                        <User className={`h-3.5 w-3.5 ${c.bot_status === "paused" ? "text-amber-500" : "text-primary"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate leading-tight">
                          {c.contact_name || c.phone}
                        </p>
                        <div className="flex items-center gap-1.5">
                          {c.bot_status === "paused"
                            ? <span className="text-[9px] text-amber-500 font-medium">● Pausado</span>
                            : <span className="text-[9px] text-emerald-500 font-medium">● Bot ativo</span>
                          }
                          <span className="text-[9px] text-muted-foreground/50">{ts(c.last_message_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {c.last_message && (
                    <p className="text-[10px] text-muted-foreground truncate mt-1 pl-9">
                      {c.last_message_role === "assistant" ? "Bot: " : ""}
                      {c.last_message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Conversa ── */}
        {!sel ? (
          <div className="rounded-xl border border-border/50 bg-card flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card flex flex-col min-h-0 overflow-hidden">

            {/* Header da conversa */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">
                    {current?.contact_name || sel}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{sel}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => window.open(`https://wa.me/${sel}`, "_blank")}>
                  <PhoneCall className="h-3 w-3" />WA
                </Button>

                {current?.bot_status === "active" ? (
                  <Button variant="outline" size="sm"
                    className="h-7 gap-1 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                    onClick={() => pauseM.mutate(sel!)}
                    disabled={pauseM.isPending}
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                    Pausar bot
                  </Button>
                ) : (
                  <Button variant="outline" size="sm"
                    className="h-7 gap-1 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    onClick={() => resumeM.mutate(sel!)}
                    disabled={resumeM.isPending}
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Reativar bot
                  </Button>
                )}

                <Button variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Descartar da lista"
                  onClick={() => dismissM.mutate(sel!)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mensagens — scroll interno, ocupa espaço disponível */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {msgsQ.isLoading && (
                <p className="text-center text-xs text-muted-foreground py-6">Carregando...</p>
              )}
              {!msgsQ.isLoading && msgs.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-6">Nenhuma mensagem</p>
              )}
              {msgs.map((msg, i) => {
                const isBot = msg.role === "assistant";
                return (
                  <div key={i} className={`flex ${isBot ? "justify-end" : "justify-start"}`}>
                    <div className={`flex items-end gap-1.5 max-w-[78%] ${isBot ? "flex-row-reverse" : ""}`}>
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${isBot ? "bg-primary/10" : "bg-secondary"}`}>
                        {isBot ? <Bot className="h-2.5 w-2.5 text-primary" /> : <User className="h-2.5 w-2.5 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words leading-relaxed ${
                          isBot
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        }`}>
                          {msg.content}
                        </div>
                        <p className={`text-[9px] text-muted-foreground mt-0.5 flex items-center gap-0.5 ${isBot ? "justify-end" : ""}`}>
                          {isBot ? "Bot" : (current?.contact_name || "Cliente")}
                          {" · "}{clock(msg.created_at)}
                          {isBot && <CheckCheck className="h-2.5 w-2.5 text-blue-400" />}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input — sempre visível; ao enviar, pausa o bot automaticamente */}
            <div className="px-3 py-2.5 border-t border-border/30 shrink-0">
              <div className="flex gap-2">
                <Input
                  placeholder={current?.bot_status === "active" ? "Responder (pausa o bot automaticamente)..." : "Sua resposta... (Enter para enviar)"}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (reply.trim()) replyM.mutate(reply.trim()); } }}
                  className="text-sm h-8"
                />
                <Button onClick={() => replyM.mutate(reply.trim())} disabled={!reply.trim() || replyM.isPending} size="icon" className="h-8 w-8 shrink-0">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
