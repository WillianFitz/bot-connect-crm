import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, ChevronDown, ChevronUp, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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

type BlockType = "text" | "wait" | "image" | "audio" | "pdf" | "video";

interface CanvasBlock {
  id: string; // local temp id
  type: BlockType;
  content: string;
  wait_seconds: number;
  caption: string;
  open: boolean;
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

const BLOCK_TYPES: { type: BlockType; label: string; description: string }[] = [
  { type: "text", label: "Enviar Texto", description: "Mensagem de texto com placeholders {{nome}} e {{empresa}}" },
  { type: "wait", label: "Esperar", description: "Aguardar um tempo antes do próximo bloco" },
  { type: "image", label: "Enviar Imagem", description: "Enviar uma imagem por URL" },
  { type: "audio", label: "Enviar Áudio", description: "Enviar um áudio por URL" },
  { type: "pdf", label: "Enviar PDF", description: "Enviar um documento PDF por URL" },
  { type: "video", label: "Enviar Vídeo", description: "Enviar um vídeo por URL" },
];

function blockLabel(type: string): string {
  return BLOCK_TYPES.find((b) => b.type === type)?.label ?? type;
}

function newBlock(type: BlockType): CanvasBlock {
  return {
    id: Math.random().toString(36).slice(2),
    type,
    content: "",
    wait_seconds: 60,
    caption: "",
    open: true,
  };
}

function secondsDisplay(s: number): string {
  if (s < 60) return `${s} segundo${s !== 1 ? "s" : ""}`;
  const m = Math.round(s / 60);
  return `${s}s (~${m} min)`;
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

  // Editor state
  const [funnelName, setFunnelName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<CanvasBlock[]>([]);
  const [funnelToDelete, setFunnelToDelete] = useState<Funnel | null>(null);

  // Drag state
  const dragSrcIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const funnelsQuery = useQuery({
    queryKey: ["funnels"],
    queryFn: api.getFunnels,
  });

  const funnels = (funnelsQuery.data ?? []) as Funnel[];

  const createFunnel = useMutation({
    mutationFn: (payload: Parameters<typeof api.createFunnel>[0]) => api.createFunnel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      resetEditor();
      toast({ title: "Funil salvo." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao salvar funil", description: err.message, variant: "destructive" });
    },
  });

  const updateFunnel = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof api.updateFunnel>[1] }) =>
      api.updateFunnel(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      resetEditor();
      toast({ title: "Funil atualizado." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar funil", description: err.message, variant: "destructive" });
    },
  });

  const deleteFunnel = useMutation({
    mutationFn: (id: number) => api.deleteFunnel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnels"] });
      setFunnelToDelete(null);
      toast({ title: "Funil excluído." });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  function resetEditor() {
    setFunnelName("");
    setEditingId(null);
    setBlocks([]);
  }

  function loadFunnelForEdit(f: Funnel) {
    setFunnelName(f.name);
    setEditingId(f.id);
    setBlocks(stepsToBlocks(f.steps));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, newBlock(type)]);
  }

  function removeBlock(idx: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateBlock(idx: number, patch: Partial<CanvasBlock>) {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  }

  function toggleBlock(idx: number) {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, open: !b.open } : b)));
  }

  function moveBlock(idx: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  // Drag & drop handlers for canvas reorder
  function onDragStartCanvas(idx: number) {
    dragSrcIndex.current = idx;
  }

  function onDragOverCanvas(e: React.DragEvent, idx: number) {
    e.preventDefault();
    dragOverIndex.current = idx;
  }

  function onDropCanvas() {
    const from = dragSrcIndex.current;
    const to = dragOverIndex.current;
    if (from === null || to === null || from === to) return;
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragSrcIndex.current = null;
    dragOverIndex.current = null;
  }

  // Drag from palette to canvas
  const dragPaletteType = useRef<BlockType | null>(null);

  function onDragStartPalette(type: BlockType) {
    dragPaletteType.current = type;
  }

  function onDropCanvas_palette(e: React.DragEvent) {
    e.preventDefault();
    if (dragPaletteType.current) {
      addBlock(dragPaletteType.current);
      dragPaletteType.current = null;
    }
  }

  function handleSaveDraft() {
    if (!funnelName.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    const steps = blocks.map((b, i) => ({
      type: b.type,
      content: b.content || undefined,
      wait_seconds: b.wait_seconds,
      caption: b.caption || undefined,
      position: i,
    }));
    if (editingId) {
      updateFunnel.mutate({ id: editingId, payload: { name: funnelName.trim(), status: "draft", steps } });
    } else {
      createFunnel.mutate({ name: funnelName.trim(), status: "draft", steps });
    }
  }

  function handlePublish() {
    if (!funnelName.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    const steps = blocks.map((b, i) => ({
      type: b.type,
      content: b.content || undefined,
      wait_seconds: b.wait_seconds,
      caption: b.caption || undefined,
      position: i,
    }));
    if (editingId) {
      updateFunnel.mutate({ id: editingId, payload: { name: funnelName.trim(), status: "published", steps } });
    } else {
      createFunnel.mutate({ name: funnelName.trim(), status: "published", steps });
    }
  }

  const isSaving = createFunnel.isPending || updateFunnel.isPending;

  function totalWait(): number {
    return blocks.filter((b) => b.type === "wait").reduce((s, b) => s + (b.wait_seconds || 0), 0);
  }

  return (
    <div className="space-y-6 animate-slide-in max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Funil de Prospecção</h1>
        <p className="text-sm text-muted-foreground">
          Crie sequências automáticas de mensagens para prospects.
        </p>
      </div>

      {/* Editor */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="grid grid-cols-[200px_1fr] divide-x divide-border/50 min-h-[340px]">
          {/* Palette */}
          <div className="p-4 space-y-2 bg-secondary/30">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">Blocos</p>
            {BLOCK_TYPES.map((bt) => (
              <div
                key={bt.type}
                draggable
                onDragStart={() => onDragStartPalette(bt.type)}
                title={bt.description}
                className="rounded-md border border-border/50 bg-card px-3 py-2 text-xs text-foreground cursor-grab hover:border-primary/50 hover:bg-primary/5 transition-colors select-none"
              >
                {bt.label}
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div
            className="p-4 flex flex-col gap-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropCanvas_palette}
          >
            {blocks.length === 0 && (
              <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-border/40 text-xs text-muted-foreground min-h-[120px]">
                Arraste blocos da paleta ou use os botões abaixo
              </div>
            )}

            {blocks.map((block, idx) => (
              <div
                key={block.id}
                draggable
                onDragStart={() => onDragStartCanvas(idx)}
                onDragOver={(e) => onDragOverCanvas(e, idx)}
                onDrop={onDropCanvas}
                className="rounded-lg border border-border/50 bg-secondary/20 cursor-grab"
                onKeyDown={(e) => {
                  if (e.altKey && e.key === "ArrowUp") moveBlock(idx, -1);
                  if (e.altKey && e.key === "ArrowDown") moveBlock(idx, 1);
                  if (e.key === "Delete") removeBlock(idx);
                }}
                tabIndex={0}
              >
                {/* Block header */}
                <div
                  className="flex items-center justify-between px-3 py-2 cursor-pointer"
                  onClick={() => toggleBlock(idx)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono">{idx + 1}</span>
                    <span className="text-xs font-medium text-foreground">{blockLabel(block.type)}</span>
                    {block.type === "wait" && (
                      <span className="text-[10px] text-muted-foreground">{secondsDisplay(block.wait_seconds)}</span>
                    )}
                    {block.type === "text" && block.content && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{block.content.slice(0, 40)}{block.content.length > 40 ? "…" : ""}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); moveBlock(idx, -1); }}
                      title="Mover para cima (Alt+↑)"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={(e) => { e.stopPropagation(); moveBlock(idx, 1); }}
                      title="Mover para baixo (Alt+↓)"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={(e) => { e.stopPropagation(); removeBlock(idx); }}
                      title="Remover bloco (Delete)"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    {block.open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </div>

                {/* Block config */}
                {block.open && (
                  <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/30">
                    {block.type === "text" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Mensagem</Label>
                        <Textarea
                          className="mt-1 bg-background border-border/50 text-xs resize-none"
                          rows={4}
                          placeholder="Olá {{nome}}, tudo bem? Sou da {{empresa}}..."
                          value={block.content}
                          onChange={(e) => updateBlock(idx, { content: e.target.value })}
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Placeholders: <code>{"{{nome}}"}</code>, <code>{"{{empresa}}"}</code>
                        </p>
                      </div>
                    )}

                    {block.type === "wait" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Aguardar (segundos)</Label>
                        <div className="flex items-center gap-3 mt-1">
                          <Input
                            type="number"
                            min={1}
                            className="bg-background border-border/50 text-xs w-32"
                            value={block.wait_seconds}
                            onChange={(e) => updateBlock(idx, { wait_seconds: Math.max(1, Number(e.target.value) || 1) })}
                          />
                          <span className="text-xs text-muted-foreground">{secondsDisplay(block.wait_seconds)}</span>
                        </div>
                      </div>
                    )}

                    {(block.type === "image" || block.type === "video" || block.type === "pdf") && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">URL do arquivo</Label>
                          <Input
                            className="mt-1 bg-background border-border/50 text-xs"
                            placeholder="https://..."
                            value={block.content}
                            onChange={(e) => updateBlock(idx, { content: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
                          <Input
                            className="mt-1 bg-background border-border/50 text-xs"
                            placeholder="Legenda da mídia..."
                            value={block.caption}
                            onChange={(e) => updateBlock(idx, { caption: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {block.type === "audio" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">URL do áudio</Label>
                        <Input
                          className="mt-1 bg-background border-border/50 text-xs"
                          placeholder="https://..."
                          value={block.content}
                          onChange={(e) => updateBlock(idx, { content: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Quick-add buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/20">
              {BLOCK_TYPES.map((bt) => (
                <Button
                  key={bt.type}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={() => addBlock(bt.type)}
                >
                  <Plus className="h-3 w-3" />
                  {bt.label}
                </Button>
              ))}
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
            {totalWait() > 0 && <span>· ~{secondsDisplay(totalWait())}</span>}
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
          >
            {isSaving ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button
            size="sm"
            disabled={isSaving || !funnelName.trim()}
            onClick={handlePublish}
          >
            {isSaving ? "Publicando..." : "Publicar"}
          </Button>
        </div>

        <div className="px-4 py-2 bg-secondary/10 border-t border-border/20">
          <p className="text-[10px] text-muted-foreground">
            Dica: arraste blocos para reordenar. No bloco focado, use <kbd className="px-1 rounded border border-border/50 font-mono">Alt+↑</kbd> / <kbd className="px-1 rounded border border-border/50 font-mono">Alt+↓</kbd> para mover e <kbd className="px-1 rounded border border-border/50 font-mono">Delete</kbd> para remover.
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["funnels"] })}
          >
            Atualizar
          </Button>
        </div>

        <div className="border border-border/30 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border/40">
              <tr>
                {["Nome", "Status", "Blocos", "Versão", "Ações"].map((h) => (
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
              {funnels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {funnelsQuery.isLoading ? "Carregando..." : "Nenhum funil criado"}
                  </td>
                </tr>
              ) : (
                funnels.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-foreground">{f.name}</td>
                    <td className="px-3 py-2 text-xs">
                      <Badge variant="secondary" className="text-[10px]">
                        {f.status === "published" ? "Publicado" : "Rascunho"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{f.steps.length}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">v{f.version}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => loadFunnelForEdit(f)}
                          title="Editar funil"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                          onClick={() => setFunnelToDelete(f)}
                          title="Excluir funil"
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

      <AlertDialog open={!!funnelToDelete} onOpenChange={(open) => !open && setFunnelToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funil</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o funil &quot;{funnelToDelete?.name}&quot;? Todas as execuções ativas serão canceladas. Esta ação não pode ser desfeita.
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
  );
}
