import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare, CheckCheck, Clock, User, Bot, Send,
  PhoneCall, CircleCheck, Inbox, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ConvRow = {
  phone: string;
  contact_name: string | null;
  handoff_status: "pending" | "active";
  trigger_reason: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  last_message_role: string | null;
  last_message_at: string | null;
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

function StatusBadge({ status }: { status: "pending" | "active" }) {
  if (status === "pending")
    return <Badge variant="outline" className="text-yellow-600 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 text-[10px]">Aguardando</Badge>;
  return <Badge variant="outline" className="text-blue-500 border-blue-400 bg-blue-50 dark:bg-blue-950/20 text-[10px]">Em atendimento</Badge>;
}

export default function InboxPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [reply, setReply] = useState("");
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

  const resolveMutation = useMutation({
    mutationFn: (phone: string) => api.resolveInbox(phone),
    onSuccess: (_, phone) => {
      toast({ title: "Conversa encerrada", description: "Bot reativado para este contato." });
      if (selectedPhone === phone) setSelectedPhone(null);
      qc.invalidateQueries({ queryKey: ["inbox-handoffs"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: (phone: string) => api.dismissInbox(phone),
    onSuccess: (_, phone) => {
      if (selectedPhone === phone) setSelectedPhone(null);
      qc.invalidateQueries({ queryKey: ["inbox-handoffs"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messagesQuery.data?.length]);

  const convs = convsQuery.data ?? [];
  const selected = convs.find((c) => c.phone === selectedPhone) ?? null;
  const messages = (messagesQuery.data ?? []) as Message[];

  function handleSend() {
    const text = reply.trim();
    if (!text || !selectedPhone) return;
    replyMutation.mutate(text);
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)] animate-slide-in">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            Inbox
            {convs.length > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">{convs.length}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Atendimentos aguardando sua resposta
          </p>
        </div>
      </div>

      {/* Layout principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 flex-1 min-h-0">

        {/* Lista */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {convsQuery.isLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
            )}
            {!convsQuery.isLoading && convs.length === 0 && (
              <div className="p-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum atendimento pendente</p>
              </div>
            )}
            {convs.map((c) => (
              <div
                key={c.phone}
                className={`group relative border-b border-border/30 transition-colors ${
                  selectedPhone === c.phone ? "bg-accent" : "hover:bg-accent/40"
                }`}
              >
                {/* Botão X para descartar — aparece no hover */}
                <button
                  className="absolute top-2 right-2 z-10 h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remover da fila"
                  onClick={(e) => { e.stopPropagation(); dismissMutation.mutate(c.phone); }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <button
                  className="w-full text-left p-3 pr-8"
                  onClick={() => setSelectedPhone(c.phone)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
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
                      <StatusBadge status={c.handoff_status} />
                    </div>
                  </div>
                  {c.last_message && (
                    <p className="text-[11px] text-muted-foreground truncate mt-1.5 pl-10">
                      {c.last_message_role === "assistant" ? "Você: " : ""}
                      {c.last_message}
                    </p>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Conversa */}
        {!selectedPhone ? (
          <div className="rounded-xl border border-border/50 bg-card flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card flex flex-col min-h-0 overflow-hidden">

            {/* Header */}
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
                    {selected && <StatusBadge status={selected.handoff_status} />}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" className="gap-1 text-xs h-7"
                  onClick={() => window.open(`https://wa.me/${selectedPhone}`, "_blank")}>
                  <PhoneCall className="h-3 w-3" />WA
                </Button>

                {/* Encerrar — reativa bot e some da lista */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm"
                      className="gap-1 text-xs h-7 text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">
                      <CircleCheck className="h-3.5 w-3.5" />
                      Encerrar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Encerrar atendimento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O bot será reativado e voltará a responder para{" "}
                        <strong>{selected?.contact_name || selectedPhone}</strong>.
                        A conversa sairá da fila.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => resolveMutation.mutate(selectedPhone!)}
                        className="bg-emerald-600 hover:bg-emerald-700">
                        Encerrar e reativar bot
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* X — remove da fila sem reativar */}
                <Button variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Remover da fila (bot continua pausado)"
                  onClick={() => dismissMutation.mutate(selectedPhone!)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Mensagens com scroll interno */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messagesQuery.isLoading && (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando...</div>
              )}
              {!messagesQuery.isLoading && messages.length === 0 && (
                <div className="text-center py-8">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem</p>
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
                          {isBot ? "Atendente" : (selected?.contact_name || "Cliente")}
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

            {/* Input */}
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
          </div>
        )}
      </div>
    </div>
  );
}
