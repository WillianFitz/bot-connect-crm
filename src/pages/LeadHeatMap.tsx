import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flame, Thermometer, Snowflake, Loader2, RefreshCw, TrendingUp, Zap, ChevronRight, Trash2, ChevronDown, ChevronUp, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { PlanLock } from "@/components/PlanLock";

interface LeadHeat {
  id: number;
  company: string;
  phone: string;
  heat_score: number | null;
  heat_label: "cold" | "warm" | "hot" | "fire" | null;
  heat_summary: string | null;
  heat_signals: string[] | null;
  heat_analyzed_at: string | null;
  conversation_count: number;
}

type HeatZone = "fire" | "hot" | "warm" | "cold" | null;

interface ZoneConfig {
  label: string;
  icon: React.ReactNode;
  range: string;
  borderColor: string;
  textColor: string;
  badgeBg: string;
  headerBg: string;
  glowClass?: string;
}

const ZONE_CONFIG: Record<string, ZoneConfig> = {
  fire: {
    label: "Em Chamas",
    icon: <Zap className="h-4 w-4" />,
    range: "9–10",
    borderColor: "border-red-500/30",
    textColor: "text-red-400",
    badgeBg: "bg-red-500/20 text-red-300 border-red-500/30",
    headerBg: "bg-red-500/10",
    glowClass: "shadow-[0_0_24px_rgba(239,68,68,0.15)] animate-pulse-slow",
  },
  hot: {
    label: "Quente",
    icon: <Flame className="h-4 w-4" />,
    range: "7–8",
    borderColor: "border-orange-500/30",
    textColor: "text-orange-400",
    badgeBg: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    headerBg: "bg-orange-500/10",
  },
  warm: {
    label: "Morno",
    icon: <Thermometer className="h-4 w-4" />,
    range: "4–6",
    borderColor: "border-yellow-500/30",
    textColor: "text-yellow-400",
    badgeBg: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    headerBg: "bg-yellow-500/10",
  },
  cold: {
    label: "Frio",
    icon: <Snowflake className="h-4 w-4" />,
    range: "0–3",
    borderColor: "border-blue-500/30",
    textColor: "text-blue-400",
    badgeBg: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    headerBg: "bg-blue-500/10",
  },
};

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "";
  // SQLite datetime('now') stores UTC without 'Z' — force UTC parsing
  const utcStr = dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
  const date = new Date(utcStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return "agora mesmo";
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "há 1 dia";
  return `há ${diffDays} dias`;
}

function parseSignals(lead: LeadHeat): string[] {
  if (!lead.heat_signals) return [];
  if (Array.isArray(lead.heat_signals)) return lead.heat_signals as string[];
  try {
    const parsed = JSON.parse(lead.heat_signals as unknown as string);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function LeadCard({
  lead,
  onAnalyze,
  isAnalyzing,
  onClearConversation,
  isClearingConversation,
}: {
  lead: LeadHeat;
  onAnalyze: (id: number) => void;
  isAnalyzing: boolean;
  onClearConversation: (id: number, phone: string) => void;
  isClearingConversation: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const zone = lead.heat_label;
  const config = zone ? ZONE_CONFIG[zone] : null;
  const signals = parseSignals(lead);
  const positiveSignals = signals.filter((s) => s.startsWith("+"));
  const negativeSignals = signals.filter((s) => s.startsWith("-"));
  const shownSignals = expanded
    ? [...positiveSignals, ...negativeSignals]
    : [...positiveSignals.slice(0, 2), ...negativeSignals.slice(0, 1)].slice(0, 3);
  const hasMoreDetails = lead.heat_summary || signals.length > 3 || lead.conversation_count > 0;
  const borderCls = config ? config.borderColor : "border-gray-500/20";
  const scoreBadgeCls = config ? config.badgeBg : "bg-gray-500/20 text-gray-300 border-gray-500/30";
  const scoreTxtCls = config ? config.textColor : "text-gray-400";

  return (
    <div
      className={`rounded-xl border ${borderCls} bg-card/40 p-3.5 space-y-2.5 hover:bg-card/60 transition-all duration-200 ${config?.glowClass ?? ""}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-foreground truncate leading-tight">{lead.company || "—"}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{lead.phone}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {lead.heat_score !== null && (
            <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${scoreBadgeCls}`}>
              <span className={`font-bold ${scoreTxtCls}`}>{lead.heat_score}</span>
              <span className="text-muted-foreground">/10</span>
            </Badge>
          )}
          <Badge variant="outline" className="text-[11px] px-1.5 py-0 border-border/50 text-muted-foreground">
            {lead.conversation_count} msgs
          </Badge>
        </div>
      </div>

      {/* Summary */}
      {lead.heat_summary && (
        <p className={`text-[12px] text-muted-foreground leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
          {lead.heat_summary}
        </p>
      )}

      {/* Signals */}
      {shownSignals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {shownSignals.map((sig, idx) => {
            const isPos = sig.startsWith("+");
            return (
              <span
                key={idx}
                className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  isPos
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/15 text-red-400 border border-red-500/20"
                }`}
              >
                {sig.slice(1)}
              </span>
            );
          })}
          {!expanded && signals.length > 3 && (
            <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-muted/40 text-muted-foreground border border-border/30">
              +{signals.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="pt-1 border-t border-border/20 space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span>{lead.conversation_count} mensagens no histórico</span>
            </div>
          </div>
          {lead.heat_analyzed_at && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Analisado {formatRelativeDate(lead.heat_analyzed_at)}</span>
            </div>
          )}
          {positiveSignals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wide">Sinais positivos</p>
              <div className="flex flex-wrap gap-1">
                {positiveSignals.map((sig, idx) => (
                  <span key={idx} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    {sig.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {negativeSignals.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wide">Sinais negativos</p>
              <div className="flex flex-wrap gap-1">
                {negativeSignals.map((sig, idx) => (
                  <span key={idx} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-red-500/15 text-red-400 border border-red-500/20">
                    {sig.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ver mais / Ver menos toggle */}
      {hasMoreDetails && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" />
              Ver menos
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Ver mais detalhes
            </>
          )}
        </button>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5 gap-1">
        {lead.heat_analyzed_at ? (
          <span className="text-[11px] text-muted-foreground/60">{formatRelativeDate(lead.heat_analyzed_at)}</span>
        ) : (
          <span className="text-[11px] text-muted-foreground/40">Não analisado</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-destructive"
            title="Zerar conversa para novo contato"
            onClick={() => onClearConversation(lead.id, lead.phone)}
            disabled={isClearingConversation}
          >
            {isClearingConversation ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={`h-6 px-2 text-[11px] gap-1 ${config ? `${config.textColor} hover:${config.textColor}` : "text-muted-foreground"}`}
            onClick={() => onAnalyze(lead.id)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : lead.heat_analyzed_at ? (
              <>
                <RefreshCw className="h-3 w-3" />
                Re-analisar
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3" />
                Analisar
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ZoneColumn({
  zone,
  leads,
  onAnalyze,
  analyzingIds,
  onClearConversation,
  clearingIds,
}: {
  zone: HeatZone;
  leads: LeadHeat[];
  onAnalyze: (id: number) => void;
  analyzingIds: Set<number>;
  onClearConversation: (id: number, phone: string) => void;
  clearingIds: Set<number>;
}) {
  const config = zone ? ZONE_CONFIG[zone] : null;
  const labelText = config ? config.label : "Não analisado";
  const rangeText = config ? config.range : "—";
  const headerBg = config ? config.headerBg : "bg-gray-500/10";
  const borderCls = config ? config.borderColor : "border-gray-500/20";
  const textCls = config ? config.textColor : "text-gray-400";
  const iconEl = config ? config.icon : <Thermometer className="h-4 w-4" />;
  const glowCls = zone === "fire" ? "shadow-[0_0_32px_rgba(239,68,68,0.08)]" : "";

  return (
    <div className={`flex flex-col min-w-[280px] max-w-[320px] rounded-xl border ${borderCls} ${glowCls} overflow-hidden`}>
      {/* Column header */}
      <div className={`${headerBg} px-4 py-3 flex items-center justify-between border-b ${borderCls}`}>
        <div className="flex items-center gap-2">
          <span className={textCls}>{iconEl}</span>
          <span className={`font-semibold text-sm ${textCls}`}>{labelText}</span>
          <span className="text-[11px] text-muted-foreground/60">({rangeText})</span>
        </div>
        <Badge variant="outline" className={`text-[11px] px-2 py-0 border-border/40 ${textCls} bg-transparent`}>
          {leads.length}
        </Badge>
      </div>

      {/* Cards scroll area */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] scrollbar-thin">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <span className={`${textCls} opacity-30 mb-2`}>{iconEl}</span>
            <p className="text-xs text-muted-foreground/50">Nenhum lead nesta zona</p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onAnalyze={onAnalyze}
              isAnalyzing={analyzingIds.has(lead.id)}
              onClearConversation={onClearConversation}
              isClearingConversation={clearingIds.has(lead.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCardHeat({
  zone,
  count,
}: {
  zone: HeatZone;
  count: number;
}) {
  const config = zone ? ZONE_CONFIG[zone] : null;
  const labelText = config ? config.label : "Aguardando";
  const iconEl = config ? config.icon : <TrendingUp className="h-4 w-4" />;
  const borderCls = config ? config.borderColor : "border-gray-500/20";
  const textCls = config ? config.textColor : "text-gray-400";
  const headerBg = config ? config.headerBg : "bg-gray-500/10";

  return (
    <div className={`rounded-xl border ${borderCls} ${headerBg} px-5 py-4 flex items-center gap-4`}>
      <span className={`${textCls} opacity-80`}>{iconEl}</span>
      <div>
        <p className={`text-2xl font-bold ${textCls}`}>{count}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{labelText}</p>
      </div>
    </div>
  );
}

export default function LeadHeatMap() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [analyzingIds, setAnalyzingIds] = useState<Set<number>>(new Set());

  const { data: planData } = useQuery({ queryKey: ["tenant-plan"], queryFn: () => api.getTenantPlan(), staleTime: 5 * 60_000 });
  const hasPro = (planData?.plan ?? "starter") === "pro";

  const { data: rawLeads = [], isLoading } = useQuery({
    queryKey: ["leads-heat"],
    queryFn: () => api.getLeadsHeat(),
    staleTime: 30_000,
  });

  const leads: LeadHeat[] = useMemo(() => {
    return rawLeads.map((l: any) => ({
      ...l,
      heat_signals: (() => {
        if (!l.heat_signals) return null;
        if (Array.isArray(l.heat_signals)) return l.heat_signals;
        try {
          const p = JSON.parse(l.heat_signals);
          return Array.isArray(p) ? p : null;
        } catch {
          return null;
        }
      })(),
    }));
  }, [rawLeads]);

  const analyzeMutation = useMutation({
    mutationFn: (id: number) => api.analyzeLeadHeat(id),
    onMutate: (id) => {
      setAnalyzingIds((prev) => new Set(prev).add(id));
    },
    onSettled: (_, __, id) => {
      setAnalyzingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["leads-heat"] });
      const labelMap: Record<string, string> = { cold: "Frio", warm: "Morno", hot: "Quente", fire: "Em Chamas" };
      toast({
        title: "Análise concluída",
        description: `Score: ${data.heat_score}/10 — ${labelMap[data.heat_label] ?? data.heat_label}`,
      });
    },
    onError: () => {
      toast({
        title: "Erro na análise",
        description: "Não foi possível analisar o lead. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const analyzeAllMutation = useMutation({
    mutationFn: () => api.analyzeAllLeadsHeat(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads-heat"] });
      toast({
        title: "Análise em lote concluída",
        description: `${data.analyzed} lead(s) analisado(s).`,
      });
    },
    onError: () => {
      toast({
        title: "Erro na análise em lote",
        description: "Não foi possível analisar os leads. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const [clearingIds, setClearingIds] = useState<Set<number>>(new Set());

  const clearConversationMutation = useMutation({
    mutationFn: ({ id, phone }: { id: number; phone: string }) =>
      api.clearLeadConversation(id, phone),
    onMutate: ({ id }) => {
      setClearingIds((prev) => new Set(prev).add(id));
    },
    onSettled: (_, __, { id }) => {
      setClearingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["leads-heat"] });
      toast({
        title: "Conversa zerada",
        description: "Histórico apagado. O lead começa do zero no próximo contato.",
      });
      // Also reset heat score locally so card goes to "Aguardando análise"
      queryClient.setQueryData(["leads-heat"], (old: any[]) =>
        old?.map((l) =>
          l.id === id
            ? { ...l, heat_score: null, heat_label: null, heat_summary: null, heat_signals: null, heat_analyzed_at: null, conversation_count: 0 }
            : l
        ) ?? old
      );
    },
    onError: () => {
      toast({ title: "Erro ao zerar conversa", variant: "destructive" });
    },
  });

  const handleAnalyze = (id: number) => {
    analyzeMutation.mutate(id);
  };

  const handleClearConversation = (id: number, phone: string) => {
    clearConversationMutation.mutate({ id, phone });
  };

  const fireLeads = leads.filter((l) => l.heat_label === "fire");
  const hotLeads = leads.filter((l) => l.heat_label === "hot");
  const warmLeads = leads.filter((l) => l.heat_label === "warm");
  const coldLeads = leads.filter((l) => l.heat_label === "cold");
  const unanalyzedLeads = leads.filter((l) => l.heat_label === null);

  const zones: Array<{ zone: HeatZone; leads: LeadHeat[] }> = [
    { zone: "fire", leads: fireLeads },
    { zone: "hot", leads: hotLeads },
    { zone: "warm", leads: warmLeads },
    { zone: "cold", leads: coldLeads },
  ];

  return (
    <PlanLock minPlan="pro" locked={!hasPro}>
    <div className="flex flex-col h-full gap-6 p-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Flame className="h-6 w-6 text-orange-400" />
            Mapa de Calor de Leads
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Análise de interesse por IA com base no histórico de conversas
          </p>
        </div>
        <Button
          onClick={() => analyzeAllMutation.mutate()}
          disabled={analyzeAllMutation.isPending || isLoading}
          className="gap-2 shrink-0"
        >
          {analyzeAllMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          Analisar Todos
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCardHeat zone="fire" count={fireLeads.length} />
        <StatCardHeat zone="hot" count={hotLeads.length} />
        <StatCardHeat zone="warm" count={warmLeads.length} />
        <StatCardHeat zone="cold" count={coldLeads.length} />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Carregando leads...</span>
        </div>
      )}

      {/* 4-column heat zone kanban */}
      {!isLoading && (
        <>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {zones.map(({ zone, leads: zoneleads }) => (
              <ZoneColumn
                key={zone ?? "null"}
                zone={zone}
                leads={zoneleads}
                onAnalyze={handleAnalyze}
                analyzingIds={analyzingIds}
                onClearConversation={handleClearConversation}
                clearingIds={clearingIds}
              />
            ))}
          </div>

          {/* Unanalyzed section */}
          {unanalyzedLeads.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
                <h2 className="text-sm font-semibold text-muted-foreground">
                  Aguardando análise
                </h2>
                <Badge variant="outline" className="text-[11px] text-muted-foreground border-border/40">
                  {unanalyzedLeads.length}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {unanalyzedLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onAnalyze={handleAnalyze}
                    isAnalyzing={analyzingIds.has(lead.id)}
                    onClearConversation={handleClearConversation}
                    isClearingConversation={clearingIds.has(lead.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {leads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Flame className="h-12 w-12 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-medium">Nenhum lead encontrado</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Importe leads com número de telefone para começar a análise de calor
              </p>
            </div>
          )}
        </>
      )}
    </div>
    </PlanLock>
  );
}
