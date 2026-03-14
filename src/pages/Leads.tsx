import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Upload, MoreHorizontal, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Leads() {
  const [search, setSearch] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [newLeadCompany, setNewLeadCompany] = useState("");
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [editingLead, setEditingLead] = useState<{
    id: number;
    company: string;
    phone: string;
    folder_id: number | null;
  } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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
          selectedFolder === "all"
            ? undefined
            : selectedFolder === "none"
            ? "none"
            : selectedFolder,
      }),
  });

  const createFolder = useMutation({
    mutationFn: (name: string) => api.createLeadFolder(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-folders"] });
      setNewFolderName("");
    },
  });

  const createLead = useMutation({
    mutationFn: () =>
      api.createLead({
        company: newLeadCompany,
        phone: newLeadPhone,
        folder_id:
          selectedFolder && selectedFolder !== "all" && selectedFolder !== "none"
            ? Number(selectedFolder)
            : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      setNewLeadCompany("");
      setNewLeadPhone("");
      setIsCreateOpen(false);
      toast({
        title: "Lead cadastrado",
        description: "O lead foi salvo. Se houver campanha ativa, ele entrará na fila de disparo.",
      });
      api.runCampaigns({ ignoreWindow: true }).catch(() => {});
    },
  });

  const updateLead = useMutation({
    mutationFn: (payload: {
      id: number;
      company: string;
      phone: string;
      folder_id: number | null;
    }) => api.updateLead(payload.id, {
      company: payload.company,
      phone: payload.phone,
      folder_id: payload.folder_id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      setEditingLead(null);
      toast({
        title: "Lead atualizado",
        description: "As informações do lead foram salvas.",
      });
    },
  });

  const deleteLead = useMutation({
    mutationFn: (id: number) => api.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
      toast({
        title: "Lead excluído",
        description: "O lead foi removido da sua lista.",
      });
    },
  });

  const leads = leadsQuery.data || [];

  return (
    <div className="space-y-6 animate-slide-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Organize e gerencie seus leads por pastas.
          </p>
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
              <DialogHeader>
                <DialogTitle>Cadastrar lead</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Input
                    className="mt-1 bg-secondary border-border/50"
                    placeholder="Empresa ABC"
                    value={newLeadCompany}
                    onChange={(e) => setNewLeadCompany(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input
                    className="mt-1 bg-secondary border-border/50"
                    placeholder="11999999999"
                    value={newLeadPhone}
                    onChange={(e) => setNewLeadPhone(e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Pasta</Label>
                  <Select
                    value={selectedFolder}
                    onValueChange={setSelectedFolder}
                  >
                    <SelectTrigger className="w-full bg-secondary border-border/50 mt-1">
                      <SelectValue placeholder="Sem pasta" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border/50">
                      <SelectItem value="none">Sem pasta</SelectItem>
                      {foldersQuery.data?.map((folder) => (
                        <SelectItem key={folder.id} value={String(folder.id)}>
                          {folder.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                disabled={!newLeadCompany || !newLeadPhone}
                onClick={() => createLead.mutate()}
              >
                Salvar
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9 bg-secondary border-border/50"
            placeholder="Buscar por nome, número ou últimos 4 dígitos..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedFolder}
            onValueChange={setSelectedFolder}
          >
            <SelectTrigger className="w-[180px] bg-secondary border-border/50">
              <SelectValue placeholder="Pastas" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border/50">
              <SelectItem value="all">Todas as pastas</SelectItem>
              <SelectItem value="none">Sem pasta</SelectItem>
              {foldersQuery.data?.map((folder) => (
                <SelectItem key={folder.id} value={String(folder.id)}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
        <div className="border-b border-border/50 bg-secondary/50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">Pastas</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Nova pasta</span>
            <Input
              className="h-7 w-36 bg-background border-border/50"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nome da pasta"
            />
            <Button
              size="xs"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={!newFolderName}
              onClick={() => newFolderName && createFolder.mutate(newFolderName)}
            >
              Salvar
            </Button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/30">
              {["Empresa", "Telefone", "Criado", "Pasta", "Ações"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-xs text-muted-foreground"
                >
                  Nenhum lead encontrado.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-border/30 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {lead.company}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.phone}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {lead.folder_name || "Sem pasta"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          setEditingLead({
                            id: lead.id,
                            company: lead.company,
                            phone: lead.phone,
                            folder_id: lead.folder_id,
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => deleteLead.mutate(lead.id)}
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

      {/* Dialog de edição de lead */}
      {editingLead && (
        <Dialog open onOpenChange={(open) => !open && setEditingLead(null)}>
          <DialogContent className="bg-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar lead</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Input
                  className="mt-1 bg-secondary border-border/50"
                  value={editingLead.company}
                  onChange={(e) =>
                    setEditingLead((prev) =>
                      prev ? { ...prev, company: e.target.value } : prev,
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input
                  className="mt-1 bg-secondary border-border/50"
                  value={editingLead.phone}
                  onChange={(e) =>
                    setEditingLead((prev) =>
                      prev ? { ...prev, phone: e.target.value } : prev,
                    )
                  }
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Pasta</Label>
                <Select
                  value={
                    editingLead.folder_id ? String(editingLead.folder_id) : "none"
                  }
                  onValueChange={(val) =>
                    setEditingLead((prev) =>
                      prev
                        ? {
                            ...prev,
                            folder_id: val === "none" ? null : Number(val),
                          }
                        : prev,
                    )
                  }
                >
                  <SelectTrigger className="w-full bg-secondary border-border/50 mt-1">
                    <SelectValue placeholder="Sem pasta" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50">
                    <SelectItem value="none">Sem pasta</SelectItem>
                    {foldersQuery.data?.map((folder) => (
                      <SelectItem key={folder.id} value={String(folder.id)}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="mt-4 w-full"
              disabled={!editingLead.company || !editingLead.phone}
              onClick={() =>
                updateLead.mutate({
                  id: editingLead.id,
                  company: editingLead.company,
                  phone: editingLead.phone,
                  folder_id: editingLead.folder_id,
                })
              }
            >
              Salvar alterações
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Página 1 / 1 · {leads.length} leads</span>
        <div className="flex items-center gap-2">
          <span>20</span>
          <span>por página</span>
        </div>
      </div>
    </div>
  );
}
