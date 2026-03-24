import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Upload, Trash2, Pencil, PauseCircle, PlayCircle, ChevronLeft, ChevronRight, FolderX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE_OPTIONS = [20, 50, 80];

export default function Leads() {
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [editingLead, setEditingLead] = useState<{
    id: number; company: string; phone: string; folder_id: number | null;
  } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const foldersQuery = useQuery({
    queryKey: ["lead-folders"],
    queryFn: api.getLeadFolders,
  });

  const leadsQuery = useQuery({
    queryKey: ["leads", { search, selectedFolder }],
    queryFn: () =>
      api.getLeads({
        q: search || undefined,
        folderId:
          selectedFolder === "all" ? undefined :
          selectedFolder === "none" ? "none" : selectedFolder,
      }),
  });

  const createFolder = useMutation({
    mutationFn: (name: string) => api.createLeadFolder(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-folders"] });
      setNewFolderName("");
    },
  });

  const deleteFolder = useMutation({
    mutationFn: (id: number) => api.deleteLeadFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-folders"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      if (selectedFolder !== "all" && selectedFolder !== "none") setSelectedFolder("all");
      toast({ title: "Pasta excluída", description: "A pasta foi removida." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const createLead = useMutation({
    mutationFn: () =>
      api.createLead({
        company: newLeadCompany,
        phone: newLeadPhone,
        folder_id:
          selectedFolder && selectedFolder !== "all" && selectedFolder !== "none"
            ? Number(selectedFolder) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      setNewLeadCompany(""); setNewLeadPhone(""); setIsCreateOpen(false);
      toast({ title: "Lead cadastrado", description: "O lead foi salvo." });
    },
  });

  const updateLead = useMutation({
    mutationFn: (payload: { id: number; company: string; phone: string; folder_id: number | null }) =>
      api.updateLead(payload.id, { company: payload.company, phone: payload.phone, folder_id: payload.folder_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      setEditingLead(null);
      toast({ title: "Lead atualizado", description: "As informações do lead foram salvas." });
    },
  });

  const deleteLead = useMutation({
    mutationFn: (id: number) => api.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      toast({ title: "Lead excluído", description: "O lead foi removido da sua lista." });
    },
  });

  const botPausesQuery = useQuery({
    queryKey: ["bot-pauses"],
    queryFn: api.getBotPauses,
    staleTime: 30_000,
  });
  const pausedPhones = new Set(botPausesQuery.data ?? []);

  const pauseBot = useMutation({
    mutationFn: (phone: string) => api.pauseLeadBot(phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-pauses"] });
      toast({ title: "Bot pausado", description: "O bot não responderá mais este contato." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const resumeBot = useMutation({
    mutationFn: (phone: string) => api.resumeLeadBot(phone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bot-pauses"] });
      toast({ title: "Bot reativado", description: "O bot voltará a responder este contato." });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const allLeads = leadsQuery.data || [];
  const totalLeads = allLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize));
  const safePage = Math.min(page, totalPages);
  const leads = allLeads.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Seleção
  const pageIds = leads.map(l => l.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const someSelected = selectedIds.size > 0;

  function toggleAll() {
    if (allPageSelected) {
      setSelectedIds(prev => { const next = new Set(prev); pageIds.forEach(id => next.delete(id)); return next; });
    } else {
      setSelectedIds(prev => { const next = new Set(prev); pageIds.forEach(id => next.add(id)); return next; });
    }
  }

  function toggleOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map(id => api.deleteLead(id)));
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    queryClient.invalidateQueries({ queryKey: ["leads-count"] });
    setSelectedIds(new Set());
    toast({ title: `${ids.length} leads excluídos` });
  }

  function handlePageSizeChange(val: string) {
    setPageSize(Number(val));
    setPage(1);
  }

  function handleFolderChange(val: string) {
    setSelectedFolder(val);
    setPage(1);
    setSelectedIds(new Set());
  }

  function handleSearch(val: string) {
    setSearch(val);
    setPage(1);
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">Organize e gerencie seus leads por pastas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-border/50">
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Novo Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border/50 max-w-lg">
              <DialogHeader><DialogTitle>Cadastrar lead</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Input className="mt-1 bg-secondary border-border/50" placeholder="Empresa ABC"
                    value={newLeadCompany} onChange={(e) => setNewLeadCompany(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input className="mt-1 bg-secondary border-border/50" placeholder="11999999999"
                    value={newLeadPhone} onChange={(e) => setNewLeadPhone(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Pasta</Label>
                  <Select value={selectedFolder} onValueChange={setSelectedFolder}>
                    <SelectTrigger className="w-full bg-secondary border-border/50 mt-1">
                      <SelectValue placeholder="Sem pasta" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border/50">
                      <SelectItem value="none">Sem pasta</SelectItem>
                      {foldersQuery.data?.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-4 w-full" disabled={!newLeadCompany || !newLeadPhone}
                onClick={() => createLead.mutate()}>Salvar</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9 bg-secondary border-border/50"
            placeholder="Buscar por nome, número ou últimos 4 dígitos..."
            value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <Select value={selectedFolder} onValueChange={handleFolderChange}>
          <SelectTrigger className="w-[180px] bg-secondary border-border/50">
            <SelectValue placeholder="Pastas" />
          </SelectTrigger>
          <SelectContent className="bg-popover border-border/50">
            <SelectItem value="all">Todas as pastas</SelectItem>
            <SelectItem value="none">Sem pasta</SelectItem>
            {foldersQuery.data?.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden w-full">
        {/* Barra de pastas */}
        <div className="border-b border-border/50 bg-secondary/50 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Pastas existentes */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground">Pastas:</span>
            {foldersQuery.data?.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma pasta criada.</span>
            )}
            {foldersQuery.data?.map((f) => (
              <div key={f.id} className="flex items-center gap-1 rounded-md bg-secondary border border-border/50 px-2 py-0.5">
                <span className="text-xs text-foreground">{f.name}</span>
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                  title="Excluir pasta"
                  onClick={() => {
                    if (confirm(`Excluir a pasta "${f.name}"? Os leads dentro dela ficam sem pasta.`))
                      deleteFolder.mutate(f.id);
                  }}
                >
                  <FolderX className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {/* Nova pasta */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Nova pasta</span>
            <Input className="h-7 w-36 bg-background border-border/50"
              value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nome da pasta"
              onKeyDown={e => e.key === "Enter" && newFolderName && createFolder.mutate(newFolderName)}
            />
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
              disabled={!newFolderName} onClick={() => newFolderName && createFolder.mutate(newFolderName)}>
              Salvar
            </Button>
          </div>
        </div>

        {/* Barra de ações em massa */}
        {someSelected && (
          <div className="border-b border-border/50 bg-primary/5 px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
            <Button size="sm" variant="destructive" className="h-7 px-3 text-xs gap-1"
              onClick={deleteSelected}>
              <Trash2 className="h-3 w-3" /> Excluir selecionados
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/30">
                <th className="px-4 py-3 w-10">
                  <Checkbox checked={allPageSelected} onCheckedChange={toggleAll}
                    aria-label="Selecionar todos da página" />
                </th>
                {["Empresa", "Telefone", "Criado", "Pasta", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Nenhum lead encontrado.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id}
                    className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox checked={selectedIds.has(lead.id)}
                        onCheckedChange={() => toggleOne(lead.id)} aria-label="Selecionar lead" />
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{lead.company}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.phone}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {lead.folder_name ? (
                        <span className="rounded-full bg-secondary px-2 py-0.5 border border-border/50">
                          {lead.folder_name}
                        </span>
                      ) : "Sem pasta"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {lead.phone && (
                          pausedPhones.has(lead.phone) ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              title="Bot pausado — clique para reativar"
                              onClick={() => resumeBot.mutate(lead.phone)} disabled={resumeBot.isPending}>
                              <PlayCircle className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                              title="Pausar bot para este lead"
                              onClick={() => pauseBot.mutate(lead.phone)} disabled={pauseBot.isPending}>
                              <PauseCircle className="h-3.5 w-3.5" />
                            </Button>
                          )
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setEditingLead({ id: lead.id, company: lead.company, phone: lead.phone, folder_id: lead.folder_id })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => deleteLead.mutate(lead.id)}>
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

        {/* Paginação */}
        <div className="border-t border-border/50 bg-secondary/20 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Exibindo</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-7 w-16 bg-secondary border-border/50 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border/50">
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>por página · <strong>{totalLeads}</strong> leads no total</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-2">
              Página {safePage} de {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7 border-border/50"
              disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 border-border/50"
              disabled={safePage >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog de edição */}
      {editingLead && (
        <Dialog open onOpenChange={(open) => !open && setEditingLead(null)}>
          <DialogContent className="bg-card border-border/50 max-w-lg">
            <DialogHeader><DialogTitle>Editar lead</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Input className="mt-1 bg-secondary border-border/50" value={editingLead.company}
                  onChange={(e) => setEditingLead(prev => prev ? { ...prev, company: e.target.value } : prev)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input className="mt-1 bg-secondary border-border/50" value={editingLead.phone}
                  onChange={(e) => setEditingLead(prev => prev ? { ...prev, phone: e.target.value } : prev)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Pasta</Label>
                <Select value={editingLead.folder_id ? String(editingLead.folder_id) : "none"}
                  onValueChange={(val) => setEditingLead(prev => prev ? { ...prev, folder_id: val === "none" ? null : Number(val) } : prev)}>
                  <SelectTrigger className="w-full bg-secondary border-border/50 mt-1">
                    <SelectValue placeholder="Sem pasta" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50">
                    <SelectItem value="none">Sem pasta</SelectItem>
                    {foldersQuery.data?.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-4 w-full" disabled={!editingLead.company || !editingLead.phone}
              onClick={() => updateLead.mutate({ id: editingLead.id, company: editingLead.company, phone: editingLead.phone, folder_id: editingLead.folder_id })}>
              Salvar alterações
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
