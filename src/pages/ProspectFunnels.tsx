import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlanLock } from "@/components/PlanLock";
import {
  MessageSquare, Clock, ImageIcon, Mic, FileText, Video,
  ChevronDown, ChevronUp, Trash2, Pencil, GitBranch, Upload, Link, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type BlockType = "text" | "wait" | "image" | "audio" | "pdf" | "video";

interface CanvasBlock {
  id: string;
  type: BlockType;
  content: string;
  wait_seconds: number;
  caption: string;
  open: boolean;
  uploading?: boolean;
}

interface FunnelStep {
  id: number;
  position: number;
  type: string;
  content: string | null;
  wait_seconds: number | null;
  caption: string | null;
}

interface Funnel {
  id: number;
  name: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
  steps: FunnelStep[];
}

interface BlockMeta {
  type: BlockType;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;       // tailwind bg/text for palette chip
  borderColor: string; // tailwind border for canvas block
  badgeColor: string;  // tailwind for badge in header
}

const BLOCK_META: BlockMeta[] = [
  {
    type: "text",
    label: "Enviar Texto",
    icon: MessageSquare,
    description: "Mensagem com {{nome}} e {{empresa}}",
    color: "bg-blue-500/10 text-blue-600 border-blue-400/40 hover:bg-blue-500/20",
    borderColor: "border-blue-400/40",
    badgeColor: "bg-blue-500/15 text-blue-600",
  },
  {
    type: "wait",
    label: "Esperar",
    icon: Clock,
    description: "Aguardar antes do próximo bloco",
    color: "bg-amber-500/10 text-amber-600 border-amber-400/40 hover:bg-amber-500/20",
    borderColor: "border-amber-400/40",
    badgeColor: "bg-amber-500/15 text-amber-600",
  },
  {
    type: "image",
    label: "Enviar Imagem",
    icon: ImageIcon,
    description: "Enviar uma imagem (upload ou URL)",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-400/40 hover:bg-emerald-500/20",
    borderColor: "border-emerald-400/40",
    badgeColor: "bg-emerald-500/15 text-emerald-600",
  },
  {
    type: "audio",
    label: "Enviar Áudio",
    icon: Mic,
    description: "Enviar um áudio (upload ou URL)",
    color: "bg-purple-500/10 text-purple-600 border-purple-400/40 hover:bg-purple-500/20",
    borderColor: "border-purple-400/40",
    badgeColor: "bg-purple-500/15 text-purple-600",
  },
  {
    type: "pdf",
    label: "Enviar PDF",
    icon: FileText,
    description: "Enviar um documento PDF (upload ou URL)",
    color: "bg-orange-500/10 text-orange-600 border-orange-400/40 hover:bg-orange-500/20",
    borderColor: "border-orange-400/40",
    badgeColor: "bg-orange-500/15 text-orange-600",
  },
  {
    type: "video",
    label: "Enviar Vídeo",
    icon: Video,
    description: "Enviar um vídeo (upload ou URL)",
    color: "bg-rose-500/10 text-rose-600 border-rose-400/40 hover:bg-rose-500/20",
    borderColor: "border-rose-400/40",
    badgeColor: "bg-rose-500/15 text-rose-600",
  },
];

const ACCEPT: Record<string, string> = {
  image: "image/*",
  audio: "audio/*",
  pdf: "application/pdf",
  video: "video/*",
};

function getMeta(type: string): BlockMeta {
  return BLOCK_META.find((b) => b.type === type) ?? BLOCK_META[0];
}

function newBlock(type: BlockType): CanvasBlock {
  return { id: Math.random().toString(36).slice(2), type, content: "", wait_seconds: 60, caption: "", open: true };
}

function secondsDisplay(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}min ${r}s` : `${m} min`;
}

function stepsToBlocks(steps: FunnelStep[]): CanvasBlock[] {
  return steps
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      id: Math.random().toString(36).slice(2),
      type: s.type as BlockType,
      content: s.content ?? "",
      wait_seconds: s.wait_seconds ?? 60,
      caption: s.caption ?? "",
      open: false,
    }));
}

export default function ProspectFunnels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: planData } = useQuery({ queryKey: ["tenant-plan"], queryFn: () => api.getTenantPlan(), staleTime: 5 * 60_000 });
  const hasPlus = ["plus", "pro"].includes(planData?.plan ?? "starter");

  const [funnelName, setFunnelName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
  const [funnelToDelete, setFunnelToDelete] = useState<Funnel | null>(null);

  const dragSrcIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);
  const dragPaletteType = useRef<BlockType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingBlockIdx = useRef<number | null>(null);

  const funnelsQuery = useQuery({ queryKey: ["funnels"], queryFn: api.getFunnels });
  const funnels = (funnelsQuery.data ?? []) as Funnel[];

  const createFunnel = useMutation({
    mutationFn: (p: Parameters<typeof api.createFunnel>[0]) => api.createFunnel(p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funnels"] }); resetEditor(); toast({ title: "Funil salvo." }); },
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const updateFunnel = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.updateFunnel>[1] }) => api.updateFunnel(id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funnels"] }); resetEditor(); toast({ title: "Funil atualizado." }); },
    onError: (e: Error) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const deleteFunnel = useMutation({
    mutationFn: (id: number) => api.deleteFunnel(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["funnels"] }); setFunnelToDelete(null); toast({ title: "Funil excluído." }); },
    onError: (e: Error) => toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" }),
  });

  function resetEditor() { setFunnelName(""); setEditingId(null); setBlocks([]); }

  function loadFunnelForEdit(f: Funnel) {
    setFunnelName(f.name); setEditingId(f.id); setBlocks(stepsToBlocks(f.steps));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addBlock(type: BlockType) { setBlocks((p) => [...p, newBlock(type)]); }
  function removeBlock(idx: number) { setBlocks((p) => p.filter((_, i) => i !== idx)); }
  function updateBlock(idx: number, patch: Partial<CanvasBlock>) { setBlocks((p) => p.map((b, i) => (i === idx ? { ...b, ...patch } : b))); }
  function toggleBlock(idx: number) { setBlocks((p) => p.map((b, i) => (i === idx ? { ...b, open: !b.open } : b))); }

  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks((p) => {
      const n = [...p];
      const t = idx + dir;
      if (t < 0 || t >= n.length) return p;
      [n[idx], n[t]] = [n[t], n[idx]];
      return n;
    });
  }

  function onDragStartCanvas(idx: number) { dragSrcIndex.current = idx; }
  function onDragOverCanvas(e: React.DragEvent, idx: number) { e.preventDefault(); dragOverIndex.current = idx; }
  function onDropCanvas() {
    const from = dragSrcIndex.current; const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;
    setBlocks((p) => { const n = [...p]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
    dragSrcIndex.current = null; dragOverIndex.current = null;
  }

  function onDragStartPalette(type: BlockType) { dragPaletteType.current = type; }
  function onDropCanvas_palette(e: React.DragEvent) {
    e.preventDefault();
    if (dragPaletteType.current) { addBlock(dragPaletteType.current); dragPaletteType.current = null; }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const idx = uploadingBlockIdx.current;
    if (idx === null) return;
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    updateBlock(idx, { uploading: true });
    try {
      const result = await api.uploadFunnelMedia(file);
      updateBlock(idx, { content: result.url, uploading: false });
      toast({ title: "Upload concluído!" });
    } catch (err: unknown) {
      updateBlock(idx, { uploading: false });
      toast({ title: "Erro no upload", description: err instanceof Error ? err.message : "Tente novamente", variant: "destructive" });
    }
  }

  function triggerUpload(idx: number, type: BlockType) {
    uploadingBlockIdx.current = idx;
    if (fileInputRef.current) {
      fileInputRef.current.accept = ACCEPT[type] ?? "*/*";
      fileInputRef.current.click();
    }
  }

  function buildSteps() {
    return blocks.map((b, i) => ({ type: b.type, content: b.content || undefined, wait_seconds: b.wait_seconds, caption: b.caption || undefined, position: i }));
  }

  function handleSaveDraft() {
    if (!funnelName.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    const steps = buildSteps();
    if (editingId) updateFunnel.mutate({ id: editingId, payload: { name: funnelName.trim(), status: "draft", steps } });
    else createFunnel.mutate({ name: funnelName.trim(), status: "draft", steps });
  }

  function handlePublish() {
    if (!funnelName.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    const steps = buildSteps();
    if (editingId) updateFunnel.mutate({ id: editingId, payload: { name: funnelName.trim(), status: "published", steps } });
    else createFunnel.mutate({ name: funnelName.trim(), status: "published", steps });
  }

  const isSaving = createFunnel.isPending || updateFunnel.isPending;
  const totalWait = blocks.filter((b) => b.type === "wait").reduce((s, b) => s + (b.wait_seconds || 0), 0);

  return (
    <PlanLock minPlan="plus" locked={!hasPlus}>
    <div className="space-y-6 animate-slide-in w-full">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />

      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Funil de Prospecção</h1>
        <p className="text-sm text-muted-foreground">Crie sequências automáticas de mensagens para prospects.</p>
      </div>

      {/* Editor */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="grid grid-cols-[190px_1fr] xl:grid-cols-[220px_1fr] 2xl:grid-cols-[260px_1fr] divide-x divide-border/50 min-h-[360px]">

          {/* Palette */}
          <div className="p-4 space-y-2 bg-secondary/20">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              Blocos
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">Arraste para a área do funil →</p>
            {BLOCK_META.map((bt) => {
              const Icon = bt.icon;
              return (
                <div
                  key={bt.type}
                  draggable
                  onDragStart={() => onDragStartPalette(bt.type)}
                  title={bt.description}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-medium cursor-grab transition-all select-none flex items-center gap-2 ${bt.color}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {bt.label}
                </div>
              );
            })}
          </div>

          {/* Canvas */}
          <div
            className="p-4 flex flex-col gap-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropCanvas_palette}
          >
            {blocks.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/40 text-muted-foreground min-h-[140px] gap-2">
                <GitBranch className="h-8 w-8 opacity-20" />
                <p className="text-xs">Arraste blocos da paleta ou use os botões abaixo</p>
              </div>
            )}

            {blocks.map((block, idx) => {
              const meta = getMeta(block.type);
              const Icon = meta.icon;
              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => onDragStartCanvas(idx)}
                  onDragOver={(e) => onDragOverCanvas(e, idx)}
                  onDrop={onDropCanvas}
                  className={`rounded-lg border-2 bg-secondary/10 cursor-grab transition-all ${meta.borderColor}`}
                  onKeyDown={(e) => {
                    if (e.altKey && e.key === "ArrowUp") moveBlock(idx, -1);
                    if (e.altKey && e.key === "ArrowDown") moveBlock(idx, 1);
                    if (e.key === "Delete") removeBlock(idx);
                  }}
                  tabIndex={0}
                >
                  {/* Block header */}
                  <div
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                    onClick={() => toggleBlock(idx)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-border/40 text-[10px] font-mono text-muted-foreground shrink-0">
                        {idx + 1}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${meta.badgeColor}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      {block.type === "wait" && (
                        <span className="text-[10px] text-muted-foreground">{secondsDisplay(block.wait_seconds)}</span>
                      )}
                      {block.type === "text" && block.content && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {block.content.slice(0, 40)}{block.content.length > 40 ? "…" : ""}
                        </span>
                      )}
                      {block.type !== "text" && block.type !== "wait" && block.content && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">✓ arquivo</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-border/40 transition-colors"
                        onClick={(e) => { e.stopPropagation(); moveBlock(idx, -1); }}
                        title="Mover para cima (Alt+↑)"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-border/40 transition-colors"
                        onClick={(e) => { e.stopPropagation(); moveBlock(idx, 1); }}
                        title="Mover para baixo (Alt+↓)"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="h-6 w-6 rounded flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                        onClick={(e) => { e.stopPropagation(); removeBlock(idx); }}
                        title="Remover bloco (Delete)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {block.open
                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Block config */}
                  {block.open && (
                    <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
                      {block.type === "text" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Mensagem</Label>
                          <Textarea
                            className="mt-1.5 bg-background border-border/50 text-xs resize-none"
                            rows={4}
                            placeholder={"Oi {{nome}}, tudo bem?\nSou da LeadFlowAI e tenho uma proposta incrível pra você!"}
                            value={block.content}
                            onChange={(e) => updateBlock(idx, { content: e.target.value })}
                          />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Placeholders: <code className="bg-secondary px-1 rounded">{"{{nome}}"}</code>{" "}
                            <code className="bg-secondary px-1 rounded">{"{{empresa}}"}</code>
                          </p>
                        </div>
                      )}

                      {block.type === "wait" && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Intervalo em Segundos</Label>
                          <div className="flex items-center gap-3 mt-1.5">
                            <Input
                              type="number"
                              min={1}
                              className="bg-background border-border/50 text-xs w-28"
                              value={block.wait_seconds}
                              onChange={(e) => updateBlock(idx, { wait_seconds: Math.max(1, Number(e.target.value) || 1) })}
                            />
                            <span className="text-xs text-muted-foreground font-medium">{secondsDisplay(block.wait_seconds)}</span>
                            <div className="flex gap-1 ml-2">
                              {[30, 60, 300, 3600].map((s) => (
                                <button
                                  key={s}
                                  className="text-[10px] px-2 py-0.5 rounded border border-border/50 hover:bg-secondary text-muted-foreground transition-colors"
                                  onClick={() => updateBlock(idx, { wait_seconds: s })}
                                >
                                  {s < 60 ? `${s}s` : s < 3600 ? `${s / 60}min` : "1h"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {(block.type === "image" || block.type === "video" || block.type === "pdf" || block.type === "audio") && (
                        <>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">Arquivo</Label>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className={`gap-1.5 text-xs h-8 ${meta.color} border`}
                                variant="outline"
                                disabled={block.uploading}
                                onClick={() => triggerUpload(idx, block.type)}
                              >
                                {block.uploading
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Upload className="h-3.5 w-3.5" />}
                                {block.uploading ? "Enviando..." : "Upload"}
                              </Button>
                              <div className="relative flex-1">
                                <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                  className="pl-8 bg-background border-border/50 text-xs h-8"
                                  placeholder="Ou cole uma URL..."
                                  value={block.content}
                                  onChange={(e) => updateBlock(idx, { content: e.target.value })}
                                />
                              </div>
                            </div>
                            {block.content && (
                              <p className="text-[10px] text-emerald-600 mt-1 truncate">✓ {block.content}</p>
                            )}
                          </div>
                          {block.type !== "audio" && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
                              <Input
                                className="mt-1.5 bg-background border-border/50 text-xs"
                                placeholder="Texto que acompanha o arquivo..."
                                value={block.caption}
                                onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Quick-add buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20">
              {BLOCK_META.map((bt) => {
                const Icon = bt.icon;
                return (
                  <button
                    key={bt.type}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${bt.color}`}
                    onClick={() => addBlock(bt.type)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    + {bt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="border-t border-border/50 bg-secondary/20 px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px]">
            <Input
              className="bg-background border-border/50 text-sm"
              placeholder="Nome do funil..."
              value={funnelName}
              onChange={(e) => setFunnelName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{blocks.length} bloco{blocks.length !== 1 ? "s" : ""}</span>
            {totalWait > 0 && <span>· ~{secondsDisplay(totalWait)}</span>}
          </div>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={resetEditor} className="text-xs">
              Cancelar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={isSaving || !funnelName.trim()}
            onClick={handleSaveDraft}
            className="border-amber-400/60 text-amber-600 hover:bg-amber-500/10 hover:border-amber-400"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            {isSaving ? "Salvando..." : "💾 Salvar rascunho"}
          </Button>
          <Button
            size="sm"
            disabled={isSaving || !funnelName.trim()}
            onClick={handlePublish}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            {isSaving ? "Publicando..." : "🚀 Publicar"}
          </Button>
        </div>

        <div className="px-4 py-2 bg-secondary/10 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground">
            Dica: arraste blocos para reordenar. Use{" "}
            <kbd className="px-1 rounded border border-border/50 font-mono">Alt+↑</kbd>{" / "}
            <kbd className="px-1 rounded border border-border/50 font-mono">Alt+↓</kbd>{" "}
            para mover e{" "}
            <kbd className="px-1 rounded border border-border/50 font-mono">Delete</kbd>{" "}
            para remover o bloco focado.
          </p>
        </div>
      </div>

      {/* Funnels list */}
      <div className="rounded-xl border border-border/50 bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            Meus funis
          </h2>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["funnels"] })}>
            Atualizar
          </Button>
        </div>

        <div className="border border-border/30 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-secondary/50 border-b border-border/40">
              <tr>
                {["Nome", "Status", "Blocos", "Versão", "Ações"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[11px] uppercase text-muted-foreground tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funnels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-xs text-muted-foreground">
                    {funnelsQuery.isLoading ? "Carregando..." : "Nenhum funil criado"}
                  </td>
                </tr>
              ) : (
                funnels.map((f) => (
                  <tr key={f.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-2 text-xs font-medium text-foreground">{f.name}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${f.status === "published" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>
                        {f.status === "published" ? "✓ Publicado" : "✎ Rascunho"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{f.steps.length}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">v{f.version}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => loadFunnelForEdit(f)}
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs border-red-300 text-red-600 hover:bg-red-500/10 hover:border-red-400"
                          onClick={() => setFunnelToDelete(f)}
                        >
                          <Trash2 className="h-3 w-3" /> Excluir
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

      <AlertDialog open={!!funnelToDelete} onOpenChange={(open) => !open && setFunnelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir &quot;{funnelToDelete?.name}&quot;? Todas as execuções ativas serão canceladas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFunnel.isPending}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => funnelToDelete && deleteFunnel.mutate(funnelToDelete.id)}
              disabled={deleteFunnel.isPending}
            >
              {deleteFunnel.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PlanLock>
  );
}
