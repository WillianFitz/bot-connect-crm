import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Handoff, HandoffMessage } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  MessageSquare,
  CheckCheck,
  Clock,
  User,
  Bot,
  Send,
  RefreshCw,
  PhoneCall,
  CircleCheck,
  Inbox,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatTime(dateStr: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function formatMessageTime(dateStr: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function statusBadge(status: Handoff["status"]) {
  if (status === "pending")
    return <Badge variant="outline" className="text-yellow-600 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 text-[10px]">Aguardando</Badge>;
  if (status === "active")
    return <Badge variant="outline" className="text-green-600 border-green-400 bg-green-50 dark:bg-green-950/20 text-[10px]">Em atendimento</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-[10px]">Encerrado</Badge>;
}

export default function InboxPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [filter, setFilter] = useState<"open" | "all">("open");
  const bottomRef = useRef<HTMLDivElement>(null);

  const handoffsQuery = useQuery({
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
    onSuccess: () => {
      toast({ title: "Atendimento encerrado", description: "Bot reativado para este contato." });
      setSelectedPhone(null);
      qc.invalidateQueries({ queryKey: ["inbox-handoffs"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  const handoffs = handoffsQuery.data ?? [];
  const filtered = filter === "open"
    ? handoffs.filter((h) => h.status !== "resolved")
    : handoffs;

  const selected = handoffs.find((h) => h.phone === selectedPhone) ?? null;
  const messages: HandoffMessage[] = (messagesQuery.data ?? []) as HandoffMessage[];

  function handleSend() {
    const text = reply.trim();
    if (!text || !selectedPhone) return;
    replyMutation.mutate(text);
  }

  const openCount = handoffs.filter((h) => h.status !== "resolved").length;

  return (
    <div className="space-y-4 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            Inbox
            {openCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-xs">{openCount}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Atendimentos transferidos do bot para humano
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["inbox-handoffs"] })}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4" style={{ minHeight: 520 }}>
        {/* Left panel — conversation list */}
        <div className="rounded-xl border border-border/50 bg-card flex flex-col overflow-hidden">
          {/* Filter tabs */}
          <div className="flex border-b border-border/50">
            <button
              onClick={() => setFilter("open")}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                filter === "open"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Em aberto ({handoffs.filter((h) => h.status !== "resolved").length})
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                filter === "all"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({handoffs.length})
            </button>
          </div>

          <ScrollArea className="flex-1">
            {handoffsQuery.isLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
            )}
            {!handoffsQuery.isLoading && filtered.length === 0 && (
              <div className="p-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum atendimento</p>
              </div>
            )}
            {filtered.map((h) => (
              <button
                key={h.id}
                onClick={() => setSelectedPhone(h.phone)}
                className={`w-full text-left p-3 border-b border-border/30 hover:bg-accent/50 transition-colors ${
                  selectedPhone === h.phone ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {h.contact_name || h.phone}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {h.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-[10px] text-muted-foreground">
                      {h.last_message_at ? formatTime(h.last_message_at) : formatTime(h.created_at)}
                    </span>
                    {statusBadge(h.status)}
                  </div>
                </div>
                {h.last_message && (
                  <p className="text-[11px] text-muted-foreground truncate mt-1.5 pl-10">
                    {h.last_message_role === "assistant" ? "Você: " : ""}
                    {h.last_message}
                  </p>
                )}
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Right panel — conversation */}
        {!selectedPhone ? (
          <div className="rounded-xl border border-border/50 bg-card flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Selecione uma conversa</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card flex flex-col overflow-hidden">
            {/* Conversation header */}
            <div className="flex items-center justify-between p-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selected?.contact_name || selectedPhone}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-muted-foreground">{selectedPhone}</p>
                    {selected && statusBadge(selected.status)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open(`https://wa.me/${selectedPhone}`, "_blank")}
                >
                  <PhoneCall className="h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                {selected?.status !== "resolved" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/20"
                      >
                        <CircleCheck className="h-3.5 w-3.5" />
                        Encerrar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Encerrar atendimento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O bot será reativado e voltará a responder automaticamente para{" "}
                          <strong>{selected?.contact_name || selectedPhone}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => resolveMutation.mutate(selectedPhone)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Encerrar e reativar bot
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {messagesQuery.isLoading && (
                <div className="text-center text-sm text-muted-foreground py-8">Carregando conversa...</div>
              )}
              {messages.length === 0 && !messagesQuery.isLoading && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                  Nenhuma mensagem ainda
                </div>
              )}
              <div className="space-y-3">
                {messages.map((msg, i) => {
                  const isBot = msg.role === "assistant";
                  return (
                    <div key={i} className={`flex ${isBot ? "justify-end" : "justify-start"}`}>
                      <div className={`flex items-end gap-1.5 max-w-[75%] ${isBot ? "flex-row-reverse" : "flex-row"}`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                          isBot ? "bg-primary/10" : "bg-secondary"
                        }`}>
                          {isBot
                            ? <Bot className="h-3 w-3 text-primary" />
                            : <User className="h-3 w-3 text-muted-foreground" />
                          }
                        </div>
                        <div>
                          <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                            isBot
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-secondary text-foreground rounded-bl-sm"
                          }`}>
                            {msg.content}
                          </div>
                          <p className={`text-[10px] text-muted-foreground mt-0.5 ${isBot ? "text-right" : "text-left"}`}>
                            {isBot ? "Atendente" : (selected?.contact_name || "Cliente")}
                            {" · "}
                            {formatMessageTime(msg.created_at)}
                            {isBot && <CheckCheck className="inline h-3 w-3 ml-1 text-blue-400" />}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <Separator />

            {/* Reply input */}
            {selected?.status === "resolved" ? (
              <div className="p-3 text-center text-sm text-muted-foreground bg-secondary/30">
                Atendimento encerrado — bot reativado
              </div>
            ) : (
              <div className="p-3 flex gap-2">
                <Input
                  placeholder="Digite sua resposta..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="text-sm"
                />
                <Button
                  onClick={handleSend}
                  disabled={!reply.trim() || replyMutation.isPending}
                  size="icon"
                  className="shrink-0"
                >
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
