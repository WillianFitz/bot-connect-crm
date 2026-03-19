import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, CheckCheck, Clock, User, Bot, Send, RefreshCw,
  PhoneCall, CircleCheck, Inbox, PauseCircle, PlayCircle,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConvRow = {
  phone: string;
  contact_name: string | null;
  last_message: string | null;
  last_message_role: string | null;
  last_message_at: string | null;
  bot_status: "active" | "paused";
  handoff_id: number | null;
  handoff_status: "pending" | "active" | null;
  message_count: number;
};

type Message = { role: "user" | "assistant"; content: string; created_at: string };

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function formatMsgTime(dateStr: string) {
  try {
    const d = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function BotBadge({ status }: { status: "active" | "paused" }) {
  if (status === "paused")
    return <Badge variant="outline" className="text-amber-500 border-amber-400 bg-amber-50 dark:bg-amber-950/20 text-[10px] gap-1"><PauseCircle className="h-2.5 w-2.5" />Bot pausado</Badge>;
  return <Badge variant="outline" className="text-emerald-500 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 text-[10px] gap-1"><PlayCircle className="h-2.5 w-2.5" />Bot ativo</Badge>;
}

export default function InboxPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const convsQuery = useQuery({
    queryKey: ["inbox-handoffs"],
    queryFn: () => api.getInboxHandoffs(),
    refetchInterval: 8_000,
  });

  const messagesQuery = useQuery({
    queryKey: ["inbox-messages", selectedPhone],
    queryFn: () => api.getInboxMessages(selectedPhone!),
    enabled: !!selectedPhone,
    refetchInterval: 5_000,
  });

  const replyMutation = useMutation({
    mutationFn: (msg: string) => api.replyInbox(selectedPhone!, msg),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["inbox-messages", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["inbox-handoffs"] });
    },
    onError: (e: Error) => toast({ title: "Erro ao enviar", description: e.message, variant: "destructive" }),
  });

  const pauseMutation = useMutation({
    mutationFn: (phone: string) => api.pauseInboxBot(phone),
    onSuccess: () => {
      toast({ title: "Bot pausado", description: "Você pode responder manualmente." });
      qc.invalidateQueries({ queryKey: ["inbox-handoffs"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resolveMutation = useMutation({
    mutationFn: (phone: string) => api.resolveInbox(phone),
    onSuccess: () => {
      toast({ title: "Bot reativado" });
      qc.invalidateQueries({ queryKey: ["inbox-handoffs"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Scroll to bottom when messages load
  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messagesQuery.data?.length]);

  const convs = convsQuery.data ?? [];
  const filtered = convs.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.contact_name || "").toLowerCase().includes(q) || c.phone.includes(q);
  });

  const selected = convs.find((c) => c.phone === selectedPhone) ?? null;
  const messages = (messagesQuery.data ?? []) as Message[];

  const pausedCount = convs.filter((c) => c.bot_status === "paused").length;

  function handleSend() {
    const text = reply.trim();
    if (!text || !selectedPhone) return;
    replyMutation.mutate(text);
  }

  return (
    // Layout ocupa a altura disponível sem crescer além da tela
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)] animate-slide-in">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            Inbox
            {pausedCount > 0 && (
              <Badge className="bg-amber-500 text-white text-xs">{pausedCount} pausado{pausedCount > 1 ? "s" : ""}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitore e intervenha em qualquer conversa do bot
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["inbox-handoffs"] })} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Main grid — ocupa o espaço restante */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 flex-1 min-h-0">

        {/* Left panel */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col min-h-0 overflow-hidden">
          <div className="p-2 border-b border-border/50 shrink-0">
            <Input
              className="h-8 text-xs bg-secondary border-border/50"
              placeholder="Buscar contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Lista com scroll interno */}
          <div className="flex-1 overflow-y-auto">
            {convsQuery.isLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
            )}
            {!convsQuery.isLoading && filtered.length === 0 && (
              <div className="p-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
              </div>
            )}
            {filtered.map((c) => (
              <button
                key={c.phone}
                onClick={() => setSelectedPhone(c.phone)}
                className={`w-full text-left p-3 border-b border-border/30 hover:bg-accent/50 transition-colors ${
                  selectedPhone === c.phone ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      c.bot_status === "paused" ? "bg-amber-500/15" : "bg-primary/10"
                    }`}>
                      <User className={`h-4 w-4 ${c.bot_status === "paused" ? "text-amber-500" : "text-primary"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {c.contact_name || c.phone}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{c.phone}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{formatTime(c.last_message_at)}</span>
                    <BotBadge status={c.bot_status} />
                  </div>
                </div>
                {c.last_message && (
                  <p className="text-[11px] text-muted-foreground truncate mt-1.5 pl-10">
                    {c.last_message_role === "assistant" ? "Bot: " : ""}
                    {c.last_message}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Right panel */}
        {!selectedPhone ? (
          <div className="rounded-xl border border-border/50 bg-card flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Selecione uma conversa para monitorar</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card flex flex-col min-h-0 overflow-hidden">

            {/* Header da conversa */}
            <div className="flex items-center justify-between p-3 border-b border-border/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selected?.contact_name || selectedPhone}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-muted-foreground">{selectedPhone}</p>
                    {selected && <BotBadge status={selected.bot_status} />}
                    {selected?.message_count != null && (
                      <span className="text-[10px] text-muted-foreground/60">{selected.message_count} msgs</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                  onClick={() => window.open(`https://wa.me/${selectedPhone}`, "_blank")}>
                  <PhoneCall className="h-3 w-3" />
                  WA
                </Button>

                {selected?.bot_status === "active" ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm"
                        className="gap-1 text-xs h-7 text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/20">
                        <PauseCircle className="h-3.5 w-3.5" />
                        Pausar bot
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Pausar o bot?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O bot vai parar de responder para <strong>{selected?.contact_name || selectedPhone}</strong>. Você assume o atendimento manualmente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => pauseMutation.mutate(selectedPhone!)}
                          className="bg-amber-500 hover:bg-amber-600">
                          Pausar e assumir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm"
                        className="gap-1 text-xs h-7 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                        <CircleCheck className="h-3.5 w-3.5" />
                        Reativar bot
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Reativar o bot?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O bot voltará a responder automaticamente para <strong>{selected?.contact_name || selectedPhone}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => resolveMutation.mutate(selectedPhone!)}
                          className="bg-emerald-600 hover:bg-emerald-700">
                          Reativar bot
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Mensagens — scroll interno, ocupa espaço disponível */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messagesQuery.isLoading && (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
              )}
              {!messagesQuery.isLoading && messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                  Nenhuma mensagem
                </div>
              )}
              {messages.map((msg, i) => {
                const isBot = msg.role === "assistant";
                return (
                  <div key={i} className={`flex ${isBot ? "justify-end" : "justify-start"}`}>
                    <div className={`flex items-end gap-1.5 max-w-[76%] ${isBot ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${isBot ? "bg-primary/10" : "bg-secondary"}`}>
                        {isBot ? <Bot className="h-3 w-3 text-primary" /> : <User className="h-3 w-3 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                          isBot
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary text-foreground rounded-bl-sm"
                        }`}>
                          {msg.content}
                        </div>
                        <p className={`text-[10px] text-muted-foreground mt-0.5 flex items-center gap-0.5 ${isBot ? "justify-end" : "justify-start"}`}>
                          {isBot ? "Bot" : (selected?.contact_name || "Cliente")}
                          {" · "}{formatMsgTime(msg.created_at)}
                          {isBot && <CheckCheck className="h-3 w-3 text-blue-400" />}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input de resposta */}
            {selected?.bot_status === "active" ? (
              <div className="p-3 border-t border-border/30 bg-secondary/20 shrink-0">
                <p className="text-[11px] text-muted-foreground text-center">
                  Bot ativo — pause o bot para responder manualmente
                </p>
              </div>
            ) : (
              <div className="p-3 border-t border-border/30 flex gap-2 shrink-0">
                <Input
                  placeholder="Sua resposta..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  className="text-sm"
                />
                <Button onClick={handleSend} disabled={!reply.trim() || replyMutation.isPending} size="icon" className="shrink-0">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
